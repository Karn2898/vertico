import json
import tempfile
import uuid
from pathlib import Path
from typing import Any

from langchain_core.tools import tool

from .workspace_tools import REPO_ROOT, _resolve_repo_path


_PATCH_SESSIONS: dict[str, dict[str, Any]] = {}


def _checkpoint_path(session_id: str) -> Path:
    return Path(tempfile.gettempdir()) / f"vertico-patch-{session_id}.json"


def _read_file(path: Path) -> str | None:
    if not path.exists():
        return None
    return path.read_text(encoding="utf-8")


def _write_file(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def create_patch_session(plan: dict[str, Any]) -> dict[str, Any]:
    """Create a checkpoint and preview for a validated plan without applying it."""
    if plan.get("status") != "proposed":
        raise ValueError("only proposed plans can be prepared for approval")

    session_id = uuid.uuid4().hex
    files: dict[str, str | None] = {}
    changes = plan.get("changes", [])
    for change in changes:
        path = change["path"]
        resolved = _resolve_repo_path(path)
        files[path] = _read_file(resolved)

    checkpoint = {"session_id": session_id, "files": files}
    _checkpoint_path(session_id).write_text(json.dumps(checkpoint), encoding="utf-8")
    session = {
        "session_id": session_id,
        "plan": plan,
        "status": "awaiting_approval",
        "checkpoint": checkpoint,
    }
    _PATCH_SESSIONS[session_id] = session
    return {
        "session_id": session_id,
        "status": session["status"],
        "files": list(files),
        "changes": changes,
    }


@tool
def prepare_patch_session(plan_json: str) -> str:
    """Checkpoint a proposed JSON patch plan and return its approval session id."""
    try:
        plan = json.loads(plan_json)
    except (TypeError, json.JSONDecodeError) as exc:
        raise ValueError("plan_json must be valid JSON") from exc
    if not isinstance(plan, dict):
        raise ValueError("plan_json must contain an object")
    return json.dumps(create_patch_session(plan))


def apply_patch_session(session_id: str, approved: bool = False) -> dict[str, Any]:
    """Apply a prepared plan only after explicit approval."""
    session = _get_session(session_id)
    if session["status"] != "awaiting_approval":
        raise ValueError(f"patch session is already {session['status']}")
    if not approved:
        raise PermissionError("explicit approval is required before applying changes")

    for change in session["plan"]["changes"]:
        path = _resolve_repo_path(change["path"])
        operation = change["operation"]
        if operation == "delete":
            if path.exists():
                path.unlink()
        elif operation in {"create", "modify"}:
            content = change.get("content")
            if not isinstance(content, str):
                raise ValueError(f"approved change requires full content: {change['path']}")
            _write_file(path, content)

    session["status"] = "applied"
    return {"session_id": session_id, "status": "applied", "files": list(session["checkpoint"]["files"])}


def reject_patch_session(session_id: str) -> dict[str, Any]:
    """Restore the exact pre-application checkpoint for an applied patch session."""
    session = _get_session(session_id)
    if session["status"] not in {"awaiting_approval", "applied"}:
        raise ValueError(f"patch session is already {session['status']}")

    for relative_path, original_content in session["checkpoint"]["files"].items():
        path = _resolve_repo_path(relative_path)
        if original_content is None:
            if path.exists():
                path.unlink()
        else:
            _write_file(path, original_content)

    session["status"] = "rejected"
    _checkpoint_path(session_id).unlink(missing_ok=True)
    return {"session_id": session_id, "status": "rejected", "files": list(session["checkpoint"]["files"])}


def _get_session(session_id: str) -> dict[str, Any]:
    try:
        return _PATCH_SESSIONS[session_id]
    except KeyError as exc:
        raise ValueError(f"unknown patch session: {session_id}") from exc
