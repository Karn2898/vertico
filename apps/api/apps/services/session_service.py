from datetime import datetime
from fastapi import HTTPException
import uuid

# Single source of truth — only this file touches the store directly
_sessions: dict[str, dict] = {}


def create_session(filename: str, original_code: str) -> dict:
    session_id = str(uuid.uuid4())

    _sessions[session_id] = {
        "session_id": session_id,
        "filename": filename,
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
    return _sessions[session_id]


def get_session(session_id: str) -> dict:
    _require(session_id)
    return _sessions[session_id]


def get_all_sessions() -> list[dict]:
    return list(_sessions.values())


def update_status(session_id: str, status: str):
    _require(session_id)
    _sessions[session_id]["status"] = status


def update_agent_state(session_id: str, state_patch: dict):
    """Called by agent.py after each graph node completes."""
    _require(session_id)
    _sessions[session_id]["agent_state"].update(state_patch)


def delete_session(session_id: str) -> dict:
    _require(session_id)
    return _sessions.pop(session_id)


def require_session(session_id: str):
    """Public version — used by chat.py, diffs.py, agent.py."""
    _require(session_id)


# --- Internal ---

def _require(session_id: str):
    if session_id not in _sessions:
        raise HTTPException(status_code=404, detail="Session not found")