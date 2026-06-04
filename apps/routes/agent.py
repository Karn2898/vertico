from fastapi import APIRouter, HTTPException, Depends
import sys
from pathlib import Path

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
def run_agent(session_id: str):
    """
    Enqueue an agent graph run.
    Returns immediately with a task_id to poll.
    """
    _require(session_id)
    session = sessions[session_id]

    if session.get("status") == "running":
        raise HTTPException(status_code=409, detail="Session already running")

    # Dispatch to correct queue
    graph = ("refactor" if "graph" not in session else session.get("graph"))
    # If caller provided graph, prefer that — but keep backwards compatibility
    # Default to 'refactor'
    # Here we expect the client to POST to /run/{session_id}?graph=bugfix with body for bugfix
    # For simplicity, use session-stored graph if present.

    # TODO: allow passing parameters (e.g. error_message) via request body/params
    # For now, enqueue a refactor by default.
    task = run_refactor.delay(session_id)

    # mark queued
    sessions[session_id]["status"] = "queued"

    return {"session_id": session_id, "task_id": task.id, "status": "queued", "graph": "refactor"}


@router.get("/task/{task_id}")
def get_task_status(task_id: str):
    """
    Poll task status by Celery task_id.
    States: PENDING → STARTED → SUCCESS | FAILURE
    """
    result = AsyncResult(task_id)
    return {
        "task_id": task_id,
        "state": result.state,
        "result": result.result if result.ready() else None,
        "traceback": result.traceback if result.failed() else None,
    }