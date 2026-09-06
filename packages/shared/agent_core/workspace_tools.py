import json
import re
from pathlib import Path

from langchain_core.tools import tool


REPO_ROOT = Path(__file__).resolve().parents[3]
_IGNORED_DIRECTORIES = {
    ".git",
    ".pytest_cache",
    "__pycache__",
    "node_modules",
    "vertico",
}
_BLOCKED_FILE_NAMES = {".env", ".env.local", ".env.production", ".env.development"}


def _resolve_repo_path(relative_path: str) -> Path:
    requested = Path(relative_path)
    if requested.is_absolute():
        raise ValueError("path must be relative to the repository root")

    resolved = (REPO_ROOT / requested).resolve()
    try:
        resolved.relative_to(REPO_ROOT)
    except ValueError as exc:
        raise ValueError("path must stay inside the repository") from exc

    if any(part in _IGNORED_DIRECTORIES for part in resolved.relative_to(REPO_ROOT).parts):
        raise ValueError("path points to an ignored repository directory")
    if resolved.name in _BLOCKED_FILE_NAMES:
        raise ValueError("secret environment files cannot be read")
    return resolved


def _iter_code_files(root: Path):
    if root.is_file():
        yield root
        return

    for path in root.rglob("*"):
        if path.is_file() and not any(
            part in _IGNORED_DIRECTORIES for part in path.relative_to(REPO_ROOT).parts
        ):
            if path.name not in _BLOCKED_FILE_NAMES:
                yield path


@tool
def search_code(query: str, path: str = ".", max_results: int = 50) -> str:
    """Search repository text and return matching paths and line excerpts."""
    if not query.strip():
        raise ValueError("query must not be empty")
    if max_results < 1 or max_results > 200:
        raise ValueError("max_results must be between 1 and 200")

    root = _resolve_repo_path(path)
    pattern = re.compile(re.escape(query), re.IGNORECASE)
    matches = []
    for file_path in _iter_code_files(root):
        try:
            lines = file_path.read_text(encoding="utf-8").splitlines()
        except (OSError, UnicodeDecodeError):
            continue
        for line_number, line in enumerate(lines, start=1):
            if pattern.search(line):
                matches.append(
                    {
                        "path": str(file_path.relative_to(REPO_ROOT)).replace("\\", "/"),
                        "line": line_number,
                        "text": line.strip(),
                    }
                )
                if len(matches) >= max_results:
                    return json.dumps(matches)
    return json.dumps(matches)


@tool
def read_code_file(path: str, start_line: int = 1, end_line: int = 200) -> str:
    """Read a bounded range from one repository file."""
    if start_line < 1 or end_line < start_line:
        raise ValueError("line range is invalid")
    if end_line - start_line >= 500:
        raise ValueError("read range cannot exceed 500 lines")

    file_path = _resolve_repo_path(path)
    if not file_path.is_file():
        raise ValueError(f"file not found: {path}")

    try:
        lines = file_path.read_text(encoding="utf-8").splitlines()
    except UnicodeDecodeError as exc:
        raise ValueError("file is not UTF-8 text") from exc

    content = "\n".join(lines[start_line - 1 : end_line])
    return json.dumps(
        {
            "path": str(file_path.relative_to(REPO_ROOT)).replace("\\", "/"),
            "start_line": start_line,
            "end_line": min(end_line, len(lines)),
            "content": content,
        }
    )


workspace_tools = [search_code, read_code_file]
