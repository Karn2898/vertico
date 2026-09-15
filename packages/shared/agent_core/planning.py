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
        if operation in {"modify", "create"}:
            has_patch = isinstance(change.get("patch"), str) and change["patch"]
            has_content = isinstance(change.get("content"), str)
            if not has_patch and not has_content:
                raise ValueError(
                    f"{operation} operation requires a patch or content string: {normalized_path}"
                )

        normalized_changes.append(
            {
                "path": normalized_path,
                "operation": operation,
                "patch": change.get("patch", ""),
                "content": change.get("content"),
                "reason": change.get("reason", ""),
            }
        )

    return {
        "changes": normalized_changes,
        "needs_more_context": needs_more_context,
        "status": "needs_context" if needs_more_context else "proposed",
    }


_OPERATION_ALIASES = {
    "create_file": "create",
    "create_file": "create",
    "add_file": "create",
    "new_file": "create",
    "write": "modify",
    "update": "modify",
    "edit": "modify",
    "modify_file": "modify",
    "remove": "delete",
    "delete_file": "delete",
}


@tool
def plan_file_changes(
    changes_json: str,
    context_paths_json: str = "[]",
    needs_more_context: bool = False,
) -> str:
    """Validate a JSON list of proposed repository changes without applying them.

    Each change must have:
    - path: repository-relative file path
    - operation: one of create, modify, delete (or aliases like create_file, write, update, remove)
    - patch: unified diff-style patch string (required for create/modify)
    - content: full file content (alternative to patch for create/modify)
    - reason: explanation (required for delete)
    """
    try:
        changes = json.loads(changes_json)
        context_paths_value = json.loads(context_paths_json)
    except (TypeError, json.JSONDecodeError) as exc:
        raise ValueError(
            "changes_json and context_paths_json must be valid JSON strings. "
            "Use json.dumps() to convert dicts to strings."
        ) from exc
    if not isinstance(changes, list) or not all(isinstance(item, dict) for item in changes):
        raise ValueError("changes_json must contain a JSON list of objects")
    if not isinstance(context_paths_value, list) or not all(
        isinstance(item, str) for item in context_paths_value
    ):
        raise ValueError("context_paths_json must contain a JSON list of paths")
    context_paths = set(context_paths_value)

    normalized_changes = []
    for change in changes:
        operation = change.get("operation", "")
        original_operation = operation
        operation = _OPERATION_ALIASES.get(operation, operation)
        if operation not in _ALLOWED_OPERATIONS:
            raise ValueError(
                f"unsupported operation: {original_operation!r}. "
                f"Expected one of {_ALLOWED_OPERATIONS} or aliases: {list(_OPERATION_ALIASES.keys())}"
            )
        change["operation"] = operation
        normalized_changes.append(change)

    return json.dumps(build_patch_plan(normalized_changes, context_paths, needs_more_context))
