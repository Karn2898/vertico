from fastapi import APIRouter, HTTPException, Depends
import sys
from pathlib import Path
from pydantic import BaseModel
from typing import Optional

# Prefer the shared session store and agent graphs
from .session import sessions, _require
from celery.result import AsyncResult

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

from rag.indexers.repo_indexer import index_repo

# Celery task entrypoints
from apps.worker.runner import run_refactor, run_bugfix, run_review

VALID_GRAPHS = ("refactor", "bugfix", "review")


class RunAgentRequest(BaseModel):
    graph: str = "refactor"
    error_message: Optional[str] = None


def _dispatch(session_id: str, graph: str, error_message: Optional[str] = None):
    """Enqueue the correct Celery task for the requested graph."""
    if graph == "bugfix":
        return run_bugfix.delay(session_id, error_message or "")
    if graph == "review":
        return run_review.delay(session_id)
    return run_refactor.delay(session_id)


@router.post("/index")
def index_repository(repo_path: str, force: bool = False):
    """
    Index a repo into pgvector.
    Call this before running the agent on any new codebase.
    """
    try:
        result = index_repo(repo_path, force_reindex=force)
        return {"status": "indexed", **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/run/{session_id}")
def run_agent(session_id: str, req: RunAgentRequest):
    """
    Enqueue an agent graph run.
    Returns immediately with a task_id to poll.
    """
    _require(session_id)
    session = sessions[session_id]

    if session.get("status") in ("running", "queued"):
        raise HTTPException(status_code=409, detail="Session already running")

    graph = req.graph
    if graph not in VALID_GRAPHS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown graph '{graph}'. Expected one of {VALID_GRAPHS}",
        )

    # Persist the chosen graph so the session is the source of truth.
    session["graph"] = graph

    task = _dispatch(session_id, graph, req.error_message)

    sessions[session_id]["status"] = "queued"

    return {
        "session_id": session_id,
        "task_id": task.id,
        "status": "queued",
        "graph": graph,
    }


@router.get("/tasks/{task_id}")
def get_task_status(task_id: str):
    """
    Poll task status by Celery task_id.
    States: PENDING -> STARTED -> SUCCESS | FAILURE
    """
    result = AsyncResult(task_id)
    return {
        "task_id": task_id,
        "state": result.state,
        "result": result.result if result.ready() else None,
        "traceback": result.traceback if result.failed() else None,
    }