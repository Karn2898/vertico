import sys
import re

from datetime import datetime, timezone
import json
import importlib
import logging
from typing import Optional


def _extract_text_tool_calls(content: str) -> list[dict]:
    """Fallback parser for LLMs (such as Nemotron/DeepSeek/Qwen) that output pseudo-XML tool call blocks in raw text."""
    if not isinstance(content, str) or "<function=" not in content:
        return []
    calls = []
    func_matches = re.finditer(r"<function=([\w_]+)>(.*?)</function>", content, re.DOTALL)
    for i, match in enumerate(func_matches):
        fn_name = match.group(1)
        body = match.group(2)
        args = {}
        param_matches = re.finditer(r"<parameter=([\w_]+)>\s*(.*?)\s*</parameter>", body, re.DOTALL)
        for pmatch in param_matches:
            k = pmatch.group(1)
            v = pmatch.group(2)
            if v.isdigit():
                args[k] = int(v)
            elif (v.startswith("[") and v.endswith("]")) or (v.startswith("{") and v.endswith("}")):
                try:
                    args[k] = json.loads(v)
                except Exception:
                    args[k] = v
            else:
                args[k] = v
        calls.append({
            "id": f"text-call-{i+1}",
            "name": fn_name,
            "args": args,
        })
    return calls

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
def _process_node(session_id: str, node_name: str, node_output: dict):
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
        stream = app.stream(agent_state)
        if isinstance(stream, dict):
            stream = [stream]
        for item in stream:
            if isinstance(item, dict):
                for node_name, node_output in item.items():
                    for event in _process_node(session_id, node_name, node_output):
                        yield event
            else:
                node_name, node_output = item
                for event in _process_node(session_id, node_name, node_output):
                    yield event

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
    try:
        for round_index in range(max_tool_rounds):
            response = await llm.ainvoke(pending_messages)
            tool_calls = getattr(response, "tool_calls", []) or []
            token = getattr(response, "content", str(response))
            if isinstance(token, list):
                token = "".join(
                    item.get("text", "") if isinstance(item, dict) else str(item)
                    for item in token
                )

            if not tool_calls and isinstance(token, str):
                tool_calls = _extract_text_tool_calls(token)

            if not tool_calls:
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
            clean_messages = []
            for msg in pending_messages:
                if isinstance(msg, dict):
                    clean_messages.append(msg)
                elif hasattr(msg, "content"):
                    r = getattr(msg, "type", "assistant")
                    if r == "human":
                        r = "user"
                    clean_messages.append({"role": r, "content": str(getattr(msg, "content", ""))})

            clean_messages.append({
                "role": "user",
                "content": "Based on the tool results above, provide a clear, final answer now. Do not call any more tools.",
            })

            bare_llm = _get_llm(session)
            try:
                response = await bare_llm.ainvoke(clean_messages)
                token = getattr(response, "content", str(response))
                if isinstance(token, list):
                    token = "".join(
                        item.get("text", "") if isinstance(item, dict) else str(item)
                        for item in token
                    )
            except Exception as exc:
                logging.warning("final wrap-up LLM call failed: %s", exc)
                token = "(I gathered the requested information but encountered an issue composing the final response.)"

            full_response = token
            yield f"data: {json.dumps({'content': token})}\n\n"
    except Exception as e:
        logging.exception("chat stream failed for session %s", session_id)
        yield f"data: {json.dumps({'node': 'error', 'content': f'Stream error: {e}'})}\n\n"
    finally:
        if full_response:
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


