# apps/api/app/routes/sessions.py  ← now ONLY routes

from fastapi import APIRouter
import os

from ..schemas.session_schemas import (
    CreateSessionRequest,
    SessionResponse,
    SessionStateResponse,
)
from ..services.session_service import (
    create_session,
    get_session,
    delete_session,
    update_status,
)

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("/", response_model=SessionResponse)
def create(req: CreateSessionRequest):
    session = create_session(
        req.filename,
        req.code,
        graph=req.graph,
        llm_provider=req.llm_provider,
        llm_api_key=req.llm_api_key,
        llm_model=req.llm_model,
    )
    return _to_response(session)


@router.get("/{session_id}", response_model=SessionResponse)
def get(session_id: str):
    session = get_session(session_id)
    return _to_response(session)


@router.get("/{session_id}/state", response_model=SessionStateResponse)
def get_state(session_id: str):
    session = get_session(session_id)
    return SessionStateResponse(
        session_id=session_id,
        status=session["status"],
        **session["agent_state"]
    )


@router.patch("/{session_id}/status")
def patch_status(session_id: str, status: str):
    update_status(session_id, status)
    return {"ok": True}


@router.delete("/{session_id}")
def delete(session_id: str):
    session = delete_session(session_id)

    filename = session.get("filename")
    if filename and os.path.exists(filename):
        os.remove(filename)

    return {"deleted": session_id}


# --- Helper ---

def _to_response(session: dict) -> SessionResponse:
    state = session["agent_state"]
    return SessionResponse(
        session_id=session["session_id"],
        filename=session["filename"],
        status=session["status"],
        iterations=state["iterations"],
        errors=state["errors"],
        created_at=session["created_at"],
        llm_provider=session.get("llm_provider", "nvidia"),
        llm_model=session.get("llm_model"),
    )