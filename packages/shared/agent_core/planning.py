import ast
import json
from pathlib import Path
from typing import Any

from langchain_core.tools import tool

from .workspace_tools import _resolve_repo_path, _iter_code_files, _ACTIVE_REPO_ROOT

_ALLOWED_OPERATIONS = {"modify", "create", "delete"}


def _module_name_for(path: Path) -> str:
    """Convert a repo-relative file path to a python module name (best effort)."""
    rel = path.relative_to(_ACTIVE_REPO_ROOT.get())
    parts = list(rel.with_suffix("").parts)
    if parts and parts[-1] == "__init__":
        parts = parts[:-1]
    return ".".join(parts)


def _scan_repository_symbols() -> dict[str, list[dict[str, Any]]]:
    """Build a lightweight symbol index: file path -> {defs, imports, calls} via ast."""
    index: dict[str, dict[str, Any]] = {}
    repo_root = _ACTIVE_REPO_ROOT.get()
    root = _resolve_repo_path(".")
    for file_path in _iter_code_files(root):
        if file_path.suffix != ".py":
            continue
        try:
            tree = ast.parse(file_path.read_text(encoding="utf-8"), filename=str(file_path))
        except (OSError, UnicodeDecodeError, SyntaxError):
            continue
        rel = str(file_path.relative_to(repo_root)).replace("\\", "/")
        defs = set()
        imports: set[str] = set()
        calls: set[str] = set()
        names_used: set[str] = set()
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                defs.add(node.name)
            elif isinstance(node, ast.Import):
                for alias in node.names:
                    imports.add(alias.name)
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    imports.add(node.module)
                for alias in node.names:
                    if alias.name != "*":
                        imports.add(f"{node.module}.{alias.name}")
                        names_used.add(alias.asname or alias.name)
            elif isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                calls.add(node.func.id)
            elif isinstance(node, ast.Name):
                names_used.add(node.id)
            elif isinstance(node, ast.Attribute):
                names_used.add(node.attr)
        index[rel] = {
            "defs": defs,
            "imports": imports,
            "calls": calls,
            "names": names_used | defs,
            "module": _module_name_for(file_path),
        }
    return index

def _topological_order(changes: list[dict[str, Any]], index: dict[str, dict[str, Any]]) -> list[str]:
    """Order changes so dependencies (files imported by changed files) apply first."""
    paths = [c["path"] for c in changes]
    path_set = set(paths)

    deps: dict[str, set[str]] = {p: set() for p in paths}
    for change in changes:
        info = index.get(change["path"])
        if not info:
            continue
        for imp in info["imports"]:
            for other in path_set:
                if other == change["path"]:
                    continue
                other_module = index.get(other, {}).get("module", "")
                if other_module and (
                    imp == other_module or imp.startswith(other_module + ".")
                ):
                    deps[change["path"]].add(other)

    order: list[str] = []
    remaining = dict(deps)
    while remaining:
        ready = [p for p, d in remaining.items() if not (d & set(remaining))]
        if not ready:  # cycle — fall back to declaration order
            order.extend(p for p in paths if p in remaining)
            break
        for p in sorted(ready, key=paths.index):
            order.append(p)
            remaining.pop(p)
    return order or paths

def _analyze_impact(
    normalized_changes: list[dict[str, Any]],
    status: str,
) -> tuple[list[dict[str, Any]], str, list[str], str, list[str]]:
    """Annotate changes with impact info. Returns (changes, status, warnings, risk, extra_files)."""
    warnings: list[str] = []
    extra_files: list[str] = []
    try:
        index = _scan_repository_symbols()
    except Exception as exc:
        warnings.append(f"impact analysis skipped: {exc}")
        for change in normalized_changes:
            change["impact"] = {"importers": [], "test_files": [], "removed_symbols": []}
            change["order"] = 0
        return normalized_changes, status, warnings, "low", extra_files
    changed_paths = {c["path"] for c in normalized_changes}
    changed_modules = {
        c["path"]: index.get(c["path"], {}).get("module", _module_name_for(_resolve_repo_path(c["path"])))
        for c in normalized_changes
    }

    # Detect symbols removed/renamed per change (create/delete/modify with content).
    removed_by_path: dict[str, set[str]] = {}
    for change in normalized_changes:
        removed: set[str] = set()
        if change["operation"] == "delete":
            info = index.get(change["path"])
            removed = set(info["defs"]) if info else set()
        else:
            content = change.get("content")
            if isinstance(content, str) and content.strip():
                try:
                    new_tree = ast.parse(content)
                except SyntaxError:
                    new_tree = None
                old_defs = index.get(change["path"], {}).get("defs", set())
                if new_tree is not None:
                    new_defs = {
                        n.name
                        for n in ast.walk(new_tree)
                        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))
                    }
                    removed = old_defs - new_defs
                else:
                    # patch string only — cannot diff reliably
                    removed = set()
            # patch-only modify: treat as non-breaking, nothing detected
        removed_by_path[change["path"]] = removed
    # Map removed symbols to referencing files.
    still_referenced: dict[str, list[str]] = {}
    for change in normalized_changes:
        removed = removed_by_path[change["path"]]
        module = changed_modules.get(change["path"], "")
        referencing: list[str] = []
        for rel, info in index.items():
            if rel == change["path"] or rel in changed_paths:
                continue
            references_symbol = bool(removed & info["names"])
            imports_module = any(
                imp == module or imp.startswith(module + ".") or imp.split(".")[-1] in removed
                for imp in info["imports"]
                if module
            )
            if removed and (references_symbol or imports_module):
                referencing.append(rel)
        if removed:
            still_referenced[change["path"]] = referencing
            if referencing:
                warnings.append(
                    f"{change['path']}: removed/renamed symbols still referenced elsewhere: "
                    f"{sorted(removed)} in {sorted(referencing)}"
                )
                extra_files.extend(referencing)

    # Importers and test files per change.
    for change in normalized_changes:
        module = changed_modules.get(change["path"], "")
        importers = []
        test_files = []
        for rel, info in index.items():
            if rel == change["path"]:
                continue
            if module and any(
                imp == module or imp.startswith(module + ".") or rel + "/" in change["path"]
                for imp in info["imports"]
            ):
                importers.append(rel)
            if (rel.startswith("test") or "/test" in rel or "tests/" in rel) and (
                module and any(
                    imp == module or imp.startswith(module + ".")
                    for imp in info["imports"]
                )
            ):
                test_files.append(rel)
        change["impact"] = {
            "importers": sorted(set(importers)),
            "test_files": sorted(set(test_files)),
            "removed_symbols": sorted(removed_by_path.get(change["path"], set())),
        }

    order = _topological_order(normalized_changes, index)
    for position, path in enumerate(order, start=1):
        for change in normalized_changes:
            if change["path"] == path:
                change["order"] = position
                break
    if any(still_referenced.values()):
        status = "needs_context"

    risk = "low"
    if warnings:
        risk = "medium"
    if any(still_referenced.values()):
        risk = "high"

    return normalized_changes, status, warnings, risk, sorted(set(extra_files))


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

    normalized_changes, status, warnings, risk, extra_files = _analyze_impact(
        normalized_changes,
        "needs_context" if needs_more_context else "proposed",
    )

    plan = {
        "changes": normalized_changes,
        "needs_more_context": needs_more_context,
        "status": status,
    }
    if warnings:
        plan["warnings"] = warnings
    if extra_files:
        plan["additional_context_files"] = extra_files
    if risk != "low":
        plan["risk"] = risk
    return plan


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
