import sys
from pathlib import Path

# Ensure packages/shared is on sys.path for agent_core imports
_repo_root = Path(__file__).resolve().parents[4]
_shared_path = _repo_root / "packages" / "shared"
if str(_shared_path) not in sys.path:
    sys.path.insert(0, str(_shared_path))

from datetime import datetime, timezone
import json
import importlib
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from agent_core.workspace_tools import (
    reset_active_repo_root,
    set_active_repo_root,
    workspace_tools,
)
from agent_core.planning import plan_file_changes
from agent_core.patching import prepare_patch_session

from ..services.session_service import sessions, _require

graphs = None
try:
    graphs = importlib.import_module("agent_core.graphs")
except Exception as exc:
    logging.warning("agent_core.graphs is not available: %s", exc)


def _get_llm(session: dict):
    provider = session.get("llm_provider")
    api_key = session.get("llm_api_key")
    model = session.get("llm_model")
    config = importlib.import_module("agent_core.config")
    return config.get_llm(provider=provider, api_key=api_key, model=model)

router = APIRouter(prefix="/chat", tags=["chat"])

class ChatMessage(BaseModel):
    role: str
    content: str
    timestamp: str
    node: Optional[str] = None

class SendMessageRequest(BaseModel):
    session_id: str
    message: str

class ChatHistoryResponse(BaseModel):
    session_id: str
    messages: list[ChatMessage]


chat_histories: dict[str, list[dict]] = {}

TASK_KEYWORDS = [
    "refactor", "fix", "rewrite", "improve",
    "clean", "optimize", "review", "lint", "run"
]

def _is_task(message: str):
    """Decide if the user message should trigger the agent graph
    or just be answered conversationally.

    Simple keyword check for now — swap with LLM classifier later.
    """
    lowered = message.lower()
    return any(keyword in lowered for keyword in TASK_KEYWORDS)


@router.post("/message")
async def send_message(req: SendMessageRequest):
    """Receive a message and stream either agent execution or chat reply.

    If the message is a task, run the agent graph; otherwise stream LLM chat.
    """

    _require(req.session_id)
    _ensure_history(req.session_id)

    # save user message
    _append_message(req.session_id, role="user", content=req.message)

    if _is_task(req.message):
        return StreamingResponse(
            _stream_agent(req.session_id, req.message),
            media_type="text/event-stream",
        )

    return StreamingResponse(
        _stream_chat(req.session_id, req.message), media_type="text/event-stream"
    )

@router.get("/{session_id}/history", response_model=ChatHistoryResponse)
def get_history(session_id: str):
    _require(session_id)
    _ensure_history(session_id)

    return ChatHistoryResponse(
        session_id=session_id,
        messages=[ChatMessage(**m) for m in chat_histories[session_id]],
    )

@router.post("/{session_id}/clear")
def clear_history(session_id: str):
    """
     Reset chat history for a session.
    Does NOT reset agent state — code changes are preserved.
    """
    _require(session_id)
    chat_histories[session_id]=[]
    return {"cleared":session_id}

# streaming generators
async def _stream_agent(session_id: str, user_message: str):
    """Compile and stream the refactor graph.

    Each node (reviewer, refactorer, linter) emits an SSE event.
    """

    session = sessions[session_id]
    sessions[session_id]["status"] = "running"

    if graphs is None or not hasattr(graphs, "workflow"):
        sessions[session_id]["status"] = "failed"
        yield f"data: {json.dumps({'node': 'error', 'content': 'Agent workflow module is not available.'})}\n\n"
        return

    app = graphs.workflow.compile()
    agent_state = session["agent_state"]

    try:
        for node_name, node_output in app.stream(agent_state):
            sessions[session_id]["agent_state"].update(node_output)
            content = _node_output_to_message(node_name, node_output)

            _append_message(
                session_id,
                role="assistant",
                content=content,
                node=node_name,
            )

            event = {
                "node": node_name,
                "content": content,
                "state": {
                    "iterations": node_output.get("iterations", 0),
                    "errors": node_output.get("errors"),
                },
            }
            yield f"data: {json.dumps(event)}\n\n"

        sessions[session_id]["status"] = "done"
        yield f"data: {json.dumps({'node': 'done', 'content': 'Refactor complete.'})}\n\n"

    except Exception as e:
        sessions[session_id]["status"] = "failed"
        error_event = {"node": "error", "content": str(e)}
        yield f"data: {json.dumps(error_event)}\n\n"

async def _stream_chat(session_id: str, user_message: str):
    """Conversational path — no graph, just the LLM with history as context.

    Used for questions like "why did you change x?" or "what are the errors?"
    """

    max_tool_rounds = 4

    session = sessions[session_id]
    agent_state = session["agent_state"]
    llm = _get_llm(session)
    tools = [*workspace_tools, plan_file_changes, prepare_patch_session]
    tool_map = {tool.name: tool for tool in tools}
    if hasattr(llm, "bind_tools"):
        llm = llm.bind_tools(tools)

    system_prompt = f"""You are Vertico, an AI coding assistant.
You have tools available to search and read files in the workspace (`search_code`, `read_code_file`, `plan_file_changes`, `prepare_patch_session`).
When asked to study, explore, analyze, or search the workspace or codebase, call the available tools (`search_code`, `read_code_file`) to inspect files. Never claim you lack access to the file system or workspace.

Current session context:
- Iterations completed: {agent_state.get('iterations')}
- Last errors: {agent_state.get('errors') or 'None'}
- Review notes: {agent_state.get('review_notes') or 'Not reviewed yet'}

Answer questions about the code, the refactoring process, or errors concisely.
"""

    history = chat_histories.get(session_id, [])
    messages = [{"role": "system", "content": system_prompt}]
    messages += [
        {"role": m["role"], "content": m["content"]}
        for m in history[-10:]
        if m["role"] in ("user", "assistant")
    ]

    full_response = ""
    pending_messages = messages

    answered = False
    for round_index in range(max_tool_rounds):
        response = await llm.ainvoke(pending_messages)
        tool_calls = getattr(response, "tool_calls", []) or []
        if not tool_calls:
            token = getattr(response, "content", str(response))
            if isinstance(token, list):
                token = "".join(
                    item.get("text", "") if isinstance(item, dict) else str(item)
                    for item in token
                )
            full_response += token
            yield f"data: {json.dumps({'content': token})}\n\n"
            answered = True
            break

        logging.debug(
            "chat round %d: tool calls %s",
            round_index + 1,
            [c.get("name") for c in tool_calls],
        )

        pending_messages = [*pending_messages, response]
        for call in tool_calls:
            tool = tool_map.get(call["name"])
            if tool is None:
                result = f"Unknown tool: {call['name']}"
            else:
                root_token = None
                try:
                    workspace_root = session.get("workspace_root")
                    if workspace_root:
                        root_token = set_active_repo_root(workspace_root)
                    result = await tool.ainvoke(call.get("args", {}))
                except Exception as exc:
                    result = f"Tool error: {exc}"
                finally:
                    if root_token is not None:
                        reset_active_repo_root(root_token)
            pending_messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call["id"],
                    "content": str(result),
                }
            )
    if not answered:
        # Tool budget exhausted: run one final LLM call with tools stripped so
        # the model must produce a text answer from what it already gathered.
        bare_llm = _get_llm(session)
        try:
            response = await bare_llm.ainvoke(
                [*pending_messages, {"role": "user", "content":
                    "You have used all your tool calls. Based on the tool results "
                    "above, answer the user's question now. Do not call more tools."}]
            )
            token = getattr(response, "content", str(response))
            if isinstance(token, list):
                token = "".join(
                    item.get("text", "") if isinstance(item, dict) else str(item)
                    for item in token
                )
        except Exception as exc:
            logging.warning("final wrap-up LLM call failed: %s", exc)
            token = "(I gathered information but could not compose a final answer.)"
        if token:
            full_response += token
            yield f"data: {json.dumps({'content': token})}\n\n"

    _append_message(session_id, role="assistant", content=full_response)
    yield f"data: {json.dumps({'content': '', 'done': True})}\n\n"

def _ensure_history(session_id: str):
   if session_id not in chat_histories:
      chat_histories[session_id] = []

def _append_message(
    session_id: str,
    role: str,
    content: str,
    node: Optional[str] = None,
):
   _ensure_history(session_id)
   chat_histories[session_id].append(
      {
         "role": role,
         "content": content,
         "timestamp": datetime.now(timezone.utc).isoformat(),
         "node": node,
      }
   )

def _node_output_to_message(node_name: str, output: dict):
   """Convert raw node output dict into a human-readable chat message."""
   if node_name == "reviewer":
      return f"**Code Review**\n{output.get('review_notes', '')}"

   if node_name == "refactorer":
      code = output.get("refactored_code", "")
      return f"**Refactored Code**\n```python\n{code[:300]}...\n```"

   if node_name == "linter":
      errors = output.get("errors")
      iterations = output.get("iterations", 0)
      if errors:
         return f"**Linter** (iteration {iterations}): Found error → `{errors}`"
      return f"**Linter** (iteration {iterations}): No syntax errors ✓"

   return f"**{node_name}**: {json.dumps(output)}"


