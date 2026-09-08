import json
import hashlib
import subprocess
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


def _git_head() -> str | None:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
    except (OSError, subprocess.CalledProcessError):
        return None
    return result.stdout.strip() or None


def _content_hash(content: str | None) -> str:
    value = "<missing>" if content is None else content
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _git_head_ref(ref: str) -> str | None:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--verify", ref],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
    except (OSError, subprocess.CalledProcessError):
        return None
    return result.stdout.strip() or None


def _git_stash_files(paths: list[str], session_id: str) -> str | None:
    if not paths:
        return None
    before = _git_head_ref("refs/stash")
    result = subprocess.run(
        [
            "git",
            "stash",
            "push",
            "--include-untracked",
            "-m",
            f"vertico patch {session_id}",
            "--",
            *paths,
        ],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"git stash failed: {result.stderr.strip()}")
    after = _git_head_ref("refs/stash")
    if not after or after == before:
        return None
    return "stash@{0}"


def _git_apply_stash(stash_ref: str) -> None:
    result = subprocess.run(
        ["git", "stash", "apply", "--index", stash_ref],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"git stash apply failed: {result.stderr.strip()}")
    dropped = subprocess.run(
        ["git", "stash", "drop", stash_ref],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    if dropped.returncode != 0:
        raise RuntimeError(f"git stash drop failed: {dropped.stderr.strip()}")


def create_patch_session(plan: dict[str, Any], use_git_stash: bool = False) -> dict[str, Any]:
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

    checkpoint = {
        "session_id": session_id,
        "git_head": _git_head(),
        "files": files,
        "hashes": {path: _content_hash(content) for path, content in files.items()},
    }
    _checkpoint_path(session_id).write_text(json.dumps(checkpoint), encoding="utf-8")
    session = {
        "session_id": session_id,
        "plan": plan,
        "status": "awaiting_approval",
        "use_git_stash": use_git_stash,
        "stash_ref": None,
        "checkpoint": checkpoint,
    }
    _PATCH_SESSIONS[session_id] = session
    return {
        "session_id": session_id,
        "status": session["status"],
        "files": list(files),
        "changes": changes,
        "git_head": checkpoint["git_head"],
        "use_git_stash": use_git_stash,
        "stash_ref": None,
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

    if session["use_git_stash"]:
        session["stash_ref"] = _git_stash_files(
            list(session["checkpoint"]["files"]), session_id
        )

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
    return {
        "session_id": session_id,
        "status": "applied",
        "files": list(session["checkpoint"]["files"]),
        "stash_ref": session["stash_ref"],
    }


def reject_patch_session(session_id: str) -> dict[str, Any]:
    """Restore the exact pre-application checkpoint for an applied patch session."""
    session = _get_session(session_id)
    if session["status"] not in {"awaiting_approval", "applied"}:
        raise ValueError(f"patch session is already {session['status']}")

    for relative_path, original_content in session["checkpoint"]["files"].items():
        path = _resolve_repo_path(relative_path)
        current_content = _read_file(path)
        expected_content = original_content
        if session["status"] == "applied":
            expected_content = next(
                (
                    change.get("content")
                    for change in session["plan"]["changes"]
                    if change["path"] == relative_path
                ),
            )
            if expected_content is None and next(
                change["operation"]
                for change in session["plan"]["changes"]
                if change["path"] == relative_path
            ) == "delete":
                expected_content = None
        if _content_hash(current_content) != _content_hash(expected_content):
            raise RuntimeError(f"file changed outside patch session: {relative_path}")
        if session["stash_ref"]:
            if path.exists():
                path.unlink()
        elif original_content is None:
            if path.exists():
                path.unlink()
        else:
            _write_file(path, original_content)

    if session["stash_ref"]:
        _git_apply_stash(session["stash_ref"])
        session["stash_ref"] = None

    session["status"] = "rejected"
    _checkpoint_path(session_id).unlink(missing_ok=True)
    return {
        "session_id": session_id,
        "status": "rejected",
        "files": list(session["checkpoint"]["files"]),
        "stash_ref": None,
    }


def get_patch_session(session_id: str) -> dict[str, Any]:
    """Return the approval status and proposed changes for a patch session."""
    session = _get_session(session_id)
    return {
        "session_id": session_id,
        "status": session["status"],
        "changes": session["plan"]["changes"],
        "files": list(session["checkpoint"]["files"]),
        "git_head": session["checkpoint"]["git_head"],
        "use_git_stash": session["use_git_stash"],
        "stash_ref": session["stash_ref"],
    }


def _get_session(session_id: str) -> dict[str, Any]:
    try:
        return _PATCH_SESSIONS[session_id]
    except KeyError as exc:
        raise ValueError(f"unknown patch session: {session_id}") from exc
