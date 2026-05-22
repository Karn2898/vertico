from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid
import os

router = APIRouter(prefix="/sessions", tags=["sessions"])

sessions: dict[str, dict] = {}


class CreateSessionRequest(BaseModel):
    filename: str
    original_code: str


class SessionResponse(BaseModel):
    session_id: str
    filename: str
    status: str
    iterations: int
    errors: Optional[str] = None
    created_at: str


class SessionStateResponse(BaseModel):
    session_id: str
    original_code: str
    review_notes: str
    refactored_code: str
    iterations: int
    status: str


# routes
@router.post("/", response_model=SessionResponse)
def create_session(req: CreateSessionRequest):
    """
    Create a new refactor session.
    Stores original code and filename. Agent run is triggered separately.
    """

    session_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    sessions[session_id] = {
        "session_id": session_id,
        "filename": req.filename,
        "status": "idle",
        "created_at": now,
        "agent_state": {
            "original_code": req.original_code,
            "review_notes": "",
            "refactored_code": req.original_code,
            "errors": None,
            "iterations": 0,
        },
    }

    return _to_response(session_id)


@router.get("/{session_id}", response_model=SessionResponse)
def get_session(session_id: str):
    """Get session metadata and current status"""
    _require(session_id)
    return _to_response(session_id)


@router.get("/{session_id}/state", response_model=SessionStateResponse)
def get_session_state(session_id: str):
    """Dump the full agent state for this session.
    IDE extension polls this to know what changed
    """

    _require(session_id)
    session = sessions[session_id]
    state = session["agent_state"]

    return SessionStateResponse(
        session_id=session_id,
        original_code=state["original_code"],
        review_notes=state["review_notes"],
        refactored_code=state["refactored_code"],
        iterations=state["iterations"],
        status=session["status"],
    )


@router.patch("/{session_id}/status")
def update_status(session_id: str, status: str):
    """
    Internal — called by agent.py route to update status as graph runs.
    e.g. idle → running → done/failed
    """

    _require(session_id)
    sessions[session_id]["status"] = status
    return {"ok": True}


@router.delete("/{session_id}")
def delete_session(session_id: str):
    """
    Kill session, clean up any written files from tools.
    """
    _require(session_id)
    session = sessions.pop(session_id, None)
    if not session:
        raise HTTPException(status_code=404, detail="session not found")

    filename = session.get("filename")
    if filename and os.path.exists(filename):
        os.remove(filename)

    return {"deleted": session_id}


def _to_response(session_id: str) -> SessionResponse:
    session = sessions[session_id]
    state = session["agent_state"]
    return SessionResponse(
        session_id=session_id,
        filename=session["filename"],
        status=session["status"],
        iterations=state.get("iterations", 0),
        errors=state.get("errors"),
        created_at=session["created_at"],
    )


def _require(session_id: str) -> None:
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="session not found")