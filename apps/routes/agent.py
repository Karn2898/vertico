from fastapi import APIRouter, HTTPException
import asyncio
import sys
from pathlib import Path

# Prefer the shared session store and agent graphs
from .session import sessions, _require

router = APIRouter(prefix="/agent", tags=["agent"])

import importlib

graphs = None
try:
    graphs = importlib.import_module("agent_core.graphs")
except Exception:
    repo_root = Path(__file__).resolve().parents[2]
    shared_path = repo_root / "packages" / "shared"
    sys.path.append(str(shared_path))
    graphs = importlib.import_module("agent_core.graphs")


@router.post("/run/{session_id}")
async def run_agent(session_id: str):
    _require(session_id)
    session = sessions[session_id]

    sessions[session_id]["status"] = "running"

    try:
        app = graphs.workflow.compile()
        # Run the potentially blocking invoke in a thread
        result = await asyncio.to_thread(app.invoke, session["agent_state"])

        # Merge result into stored state
        sessions[session_id]["agent_state"].update(result or {})
        sessions[session_id]["status"] = "done"
        return {"session_id": session_id, "status": "done", "result_keys": sorted((result or {}).keys())}

    except Exception as exc:
        err = str(exc)
        sessions[session_id]["agent_state"]["errors"] = err
        sessions[session_id]["status"] = "failed"
        raise HTTPException(status_code=500, detail=f"agent run failed: {err}")