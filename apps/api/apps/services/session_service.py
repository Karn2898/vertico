from datetime import datetime
from fastapi import HTTPException
import uuid
from fastapi import Depends
from sqlmodel import Session

# `db` package is optional for the in-memory session store.
try:
    from db.database import get_session
    from db.repositories import SessionRepo
except Exception:  # pragma: no cover - db not installed
    get_session = None
    SessionRepo = None


def get_repo(dbdb: Session = Depends(get_session)) -> "SessionRepo":
    return SessionRepo(dbdb)

# Single source of truth — only this file touches the store directly
sessions: dict[str, dict] = {}


def create_session(filename: str, original_code: str, graph: str = "refactor") -> dict:
    session_id = str(uuid.uuid4())

    sessions[session_id] = {
        "session_id": session_id,
        "filename": filename,
        "graph": graph,
        "status": "idle",
        "created_at": datetime.utcnow().isoformat(),
        "agent_state": {
            "original_code": original_code,
            "review_notes": "",
            "refactored_code": original_code,
            "errors": None,
            "iterations": 0,
        }
    }
    return sessions[session_id]


def get_session(session_id: str) -> dict:
    _require(session_id)
    return sessions[session_id]


def get_all_sessions() -> list[dict]:
    return list(sessions.values())


def update_status(session_id: str, status: str):
    _require(session_id)
    sessions[session_id]["status"] = status


def update_agent_state(session_id: str, state_patch: dict):
    """Called by agent.py after each graph node completes."""
    _require(session_id)
    sessions[session_id]["agent_state"].update(state_patch)


def delete_session(session_id: str) -> dict:
    _require(session_id)
    return sessions.pop(session_id)


def require_session(session_id: str):
    """Public version — used by chat.py, diffs.py, agent.py."""
    _require(session_id)


# --- Internal ---

def _require(session_id: str):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")