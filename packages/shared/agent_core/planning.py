import json
from typing import Any

from langchain_core.tools import tool

from .workspace_tools import _resolve_repo_path

_ALLOWED_OPERATIONS = {"modify", "create", "delete"}


def build_patch_plan(
    changes: list[dict[str, Any]],
    context_paths: set[str] | None = None,
    needs_more_context: bool = False,
) -> dict[str, Any]:
    """Validate a proposed multi-file plan without changing repository files."""
    if not changes and not needs_more_context:
        raise ValueError("plan must contain a change or request more context")

    context_paths = context_paths or set()
    normalized_changes = []
    seen_paths: set[str] = set()
    for change in changes:
        path = change.get("path")
        operation = change.get("operation")
        if not isinstance(path, str) or not path:
            raise ValueError("each change requires a path")
        if operation not in _ALLOWED_OPERATIONS:
            raise ValueError(f"unsupported operation: {operation}")

        resolved = _resolve_repo_path(path)
        normalized_path = str(resolved.relative_to(_resolve_repo_path("."))).replace("\\", "/")
        if normalized_path in seen_paths:
            raise ValueError(f"duplicate change path: {normalized_path}")
        seen_paths.add(normalized_path)

        if operation == "modify" and normalized_path not in context_paths:
            raise ValueError(f"file must be read before modifying it: {normalized_path}")
        if operation == "delete" and "reason" not in change:
            raise ValueError(f"delete operation requires a reason: {normalized_path}")
        if operation in {"modify", "create"} and not isinstance(change.get("patch"), str):
            raise ValueError(f"{operation} operation requires a patch string: {normalized_path}")

        normalized_changes.append(
            {
                "path": normalized_path,
                "operation": operation,
                "patch": change.get("patch", ""),
                "reason": change.get("reason", ""),
            }
        )

    return {
        "changes": normalized_changes,
        "needs_more_context": needs_more_context,
        "status": "needs_context" if needs_more_context else "proposed",
    }


@tool
def plan_file_changes(
    changes_json: str,
    context_paths_json: str = "[]",
    needs_more_context: bool = False,
) -> str:
    """Validate a JSON list of proposed repository changes without applying them."""
    try:
        changes = json.loads(changes_json)
        context_paths_value = json.loads(context_paths_json)
    except (TypeError, json.JSONDecodeError) as exc:
        raise ValueError("changes_json and context_paths_json must be valid JSON") from exc
    if not isinstance(changes, list) or not all(isinstance(item, dict) for item in changes):
        raise ValueError("changes_json must contain a JSON list of objects")
    if not isinstance(context_paths_value, list) or not all(
        isinstance(item, str) for item in context_paths_value
    ):
        raise ValueError("context_paths_json must contain a JSON list of paths")
    context_paths = set(context_paths_value)
    return json.dumps(build_patch_plan(changes, context_paths, needs_more_context))
