from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from agent_core.patching import (
    apply_patch_session,
    create_patch_session,
    get_patch_session,
    reject_patch_session,
)
from agent_core.planning import build_patch_plan


router = APIRouter(prefix="/patches", tags=["patches"])


class PatchChange(BaseModel):
    path: str
    operation: str
    patch: str = ""
    content: str | None = None
    reason: str = ""


class PreparePatchRequest(BaseModel):
    changes: list[PatchChange] = Field(min_length=1)
    context_paths: list[str] = Field(default_factory=list)


class ApprovalRequest(BaseModel):
    approved: bool = False


def _prepare_plan(request: PreparePatchRequest) -> dict[str, Any]:
    return build_patch_plan(
        [change.model_dump(exclude_none=True) for change in request.changes],
        set(request.context_paths),
    )


@router.post("/prepare", status_code=201)
def prepare_patch(request: PreparePatchRequest):
    try:
        return create_patch_session(_prepare_plan(request))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{session_id}")
def preview_patch(session_id: str):
    try:
        return get_patch_session(session_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{session_id}/approve")
def approve_patch(session_id: str, request: ApprovalRequest):
    if not request.approved:
        raise HTTPException(status_code=400, detail="approved must be true")
    try:
        return apply_patch_session(session_id, approved=True)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{session_id}/reject")
def reject_patch(session_id: str):
    try:
        return reject_patch_session(session_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc