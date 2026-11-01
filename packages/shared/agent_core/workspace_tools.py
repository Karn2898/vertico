import fnmatch
import json
import os
import re
import shlex
import subprocess
import tempfile
import time
import xml.etree.ElementTree as ET
from contextvars import ContextVar
from pathlib import Path

from langchain_core.tools import tool


REPO_ROOT = Path(__file__).resolve().parents[3]
_ACTIVE_REPO_ROOT: ContextVar[Path] = ContextVar("active_repo_root", default=REPO_ROOT)
_IGNORED_DIRECTORIES = {
    ".git",
    ".pytest_cache",
    "__pycache__",
    "node_modules",
    # virtualenvs / build output — never part of the indexed source
    ".venv",
    "venv",
    "env",
    "Lib",
    "site-packages",
    "dist",
    "build",
}
_BLOCKED_FILE_NAMES = {".env", ".env.local", ".env.production", ".env.development"}

# Lint/Build tool allowlist
LINT_TOOLS = {
    "ruff": {
        "cmd": ["ruff", "check", "--output-format=json"],
        "install": "pip install ruff",
        "parser": "ruff",
    },
    "eslint": {
        "cmd": ["npx", "eslint", "--format=json"],
        "install": "npm install -g eslint",
        "parser": "eslint",
    },
}

BUILD_TOOLS = {
    "tsc": {
        "cmd": ["npx", "tsc", "--noEmit"],
        "install": "npm install -g typescript",
        "parser": "tsc",
    },
    "webview": {
        "cmd": ["npm", "run", "build"],
        "cwd": "webview-dev",
        "install": "cd webview-dev && npm install",
        "parser": "npm",
    },
    "extension": {
        "cmd": ["npm", "run", "build"],
        "cwd": "apps/api/apps/ide-extension",
        "install": "cd apps/api/apps/ide-extension && npm install",
        "parser": "npm",
    },
}

MAX_DIAGNOSTICS = 200

MAX_DIAGNOSTICS = 200
_ACTIVE_REPO_ROOT: ContextVar[Path] = ContextVar("active_repo_root", default=REPO_ROOT)
_IGNORED_DIRECTORIES = {
    ".git",
    ".pytest_cache",
    "__pycache__",
    "node_modules",
    # virtualenvs / build output — never part of the indexed source
    ".venv",
    "venv",
    "env",
    "Lib",
    "site-packages",
    "dist",
    "build",
}
_BLOCKED_FILE_NAMES = {".env", ".env.local", ".env.production", ".env.development"}


def _resolve_repo_path(relative_path: str) -> Path:
    repo_root = _ACTIVE_REPO_ROOT.get()
    requested = Path(relative_path.replace("\\", "/"))
    if requested.is_absolute() or requested.drive:
        # Accept a copied/absolute path as long as it stays inside the
        # workspace — otherwise the agent burns an extra LLM round trying to
        # "convert" it, and each round is expensive.
        try:
            resolved = requested.resolve()
            resolved.relative_to(repo_root)
        except ValueError as exc:
            raise ValueError(
                f"path must be inside the workspace ({repo_root})"
            ) from exc
    else:
        resolved = (repo_root / requested).resolve()
        try:
            resolved.relative_to(repo_root)
        except ValueError as exc:
            raise ValueError("path must stay inside the repository") from exc

    if any(part in _IGNORED_DIRECTORIES for part in resolved.relative_to(repo_root).parts):
        raise ValueError("path points to an ignored repository directory")
    if resolved.name in _BLOCKED_FILE_NAMES:
        raise ValueError("secret environment files cannot be read")
    return resolved


def _iter_code_files(root: Path, glob_pattern: str | None = None):
    repo_root = _ACTIVE_REPO_ROOT.get()
    if root.is_file():
        yield root
        return

    import os
    for dirpath, dirnames, filenames in os.walk(root):
        # Prune ignored directories during the walk — much faster than
        # filtering a full rglob listing on large repos.
        dirnames[:] = [d for d in dirnames if d not in _IGNORED_DIRECTORIES]
        for filename in filenames:
            if filename in _BLOCKED_FILE_NAMES:
                continue
            path = Path(dirpath) / filename
            if glob_pattern and not fnmatch.fnmatch(
                str(path.relative_to(repo_root)).replace("\\", "/"), glob_pattern
            ) and not fnmatch.fnmatch(filename, glob_pattern):
                continue
            yield path


@tool
def search_code(
    query: str,
    path: str = ".",
    max_results: int = 50,
    regex: bool = False,
    glob: str = "",
    context_lines: int = 0,
) -> str:
    """Search repository file contents and return matching paths and line excerpts.

    This searches file CONTENTS, not filenames. To find files by name, use find_files.

    Args:
        query: text to search for (plain text, or a regex when regex=True).
        path: repository-relative directory or file to search in.
        max_results: maximum number of matches to return.
        regex: treat query as a regular expression instead of plain text.
        glob: optional glob pattern to restrict searched files (e.g. "*.py", "*.ts").
        context_lines: number of surrounding lines to include around each match.
    """
    if not query.strip():
        raise ValueError("query must not be empty")
    if max_results < 1 or max_results > 200:
        raise ValueError("max_results must be between 1 and 200")
    if context_lines < 0 or context_lines > 10:
        raise ValueError("context_lines must be between 0 and 10")

    root = _resolve_repo_path(path)
    repo_root = _ACTIVE_REPO_ROOT.get()
    if regex:
        try:
            pattern = re.compile(query, re.IGNORECASE)
        except re.error as exc:
            raise ValueError(f"invalid regex: {exc}") from exc
    else:
        pattern = re.compile(re.escape(query), re.IGNORECASE)

    matches = []
    for file_path in _iter_code_files(root, glob_pattern=glob or None):
        try:
            lines = file_path.read_text(encoding="utf-8").splitlines()
        except (OSError, UnicodeDecodeError):
            continue
        for line_number, line in enumerate(lines, start=1):
            if pattern.search(line):
                if context_lines > 0:
                    start = max(0, line_number - 1 - context_lines)
                    end = min(len(lines), line_number + context_lines)
                    text = "\n".join(
                        f"{i + 1}: {lines[i]}" for i in range(start, end)
                    )
                else:
                    text = line.strip()
                matches.append(
                    {
                        "path": str(file_path.relative_to(repo_root)).replace("\\", "/"),
                        "line": line_number,
                        "text": text,
                    }
                )
                if len(matches) >= max_results:
                    return json.dumps(matches)
    return json.dumps(matches)


@tool
def find_files(pattern: str, path: str = ".") -> str:
    """Find repository files by filename glob pattern.

    Searches file NAMES, not contents. For content search use search_code.

    Args:
        pattern: glob pattern matched against file names and paths,
            e.g. "*.py", "test_*", "config/*.yaml".
        path: repository-relative directory to search in.
    """
    if not pattern.strip():
        raise ValueError("pattern must not be empty")

    root = _resolve_repo_path(path)
    repo_root = _ACTIVE_REPO_ROOT.get()
    normalized = pattern.replace("\\", "/")

    matches = []
    if root.is_file():
        candidates = [root]
    else:
        candidates = []
        if fnmatch.fnmatch(root.name, normalized):
            matches.append(root)
        for candidate in sorted(root.rglob("*")):
            if not candidate.is_file():
                continue
            rel_parts = candidate.relative_to(repo_root).parts
            if any(part in _IGNORED_DIRECTORIES for part in rel_parts):
                continue
            if candidate.name in _BLOCKED_FILE_NAMES:
                continue
            candidates.append(candidate)

    for candidate in candidates:
        if fnmatch.fnmatch(candidate.name, normalized) or fnmatch.fnmatch(
            str(candidate.relative_to(repo_root)).replace("\\", "/"), normalized
        ):
            matches.append(candidate)

    return json.dumps(
        [str(m.relative_to(repo_root)).replace("\\", "/") for m in matches]
    )


@tool
def read_code_file(path: str, start_line: int = 1, end_line: int = 200) -> str:
    """Read a bounded range from one repository file."""
    if start_line < 1 or end_line < start_line:
        raise ValueError("line range is invalid")
    if end_line - start_line >= 500:
        raise ValueError("read range cannot exceed 500 lines")

    file_path = _resolve_repo_path(path)
    repo_root = _ACTIVE_REPO_ROOT.get()
    if not file_path.is_file():
        raise ValueError(f"file not found: {path}")

    try:
        lines = file_path.read_text(encoding="utf-8").splitlines()
    except UnicodeDecodeError as exc:
        raise ValueError("file is not UTF-8 text") from exc

    content = "\n".join(lines[start_line - 1 : end_line])
    return json.dumps(
        {
            "path": str(file_path.relative_to(repo_root)).replace("\\", "/"),
            "start_line": start_line,
            "end_line": min(end_line, len(lines)),
            "content": content,
        }
    )


@tool
def get_git_status() -> str:
    """Check git status of active workspace to see staged, unstaged, and untracked files ready for commit."""
    repo_root = _ACTIVE_REPO_ROOT.get()
    try:
        res = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=repo_root,
            capture_output=True,
            text=True,
            timeout=10,
        )
        if res.returncode != 0:
            return json.dumps({"error": f"git status failed: {res.stderr}"})
        lines = [line for line in res.stdout.splitlines() if line.strip()]
        if not lines:
            return json.dumps({"status": "clean", "staged": [], "modified": [], "untracked": []})

        staged = []
        modified = []
        untracked = []
        for line in lines:
            x = line[0]
            y = line[1]
            filepath = line[3:].strip()
            if x in ("A", "M", "R", "D", "C"):
                staged.append({"file": filepath, "action": x})
            if y in ("M", "D"):
                modified.append({"file": filepath, "action": y})
            if x == "?" and y == "?":
                untracked.append({"file": filepath})

        return json.dumps({
            "status": "dirty",
            "staged_ready_to_commit": staged,
            "unstaged_modified": modified,
            "untracked": untracked,
        })
    except Exception as exc:
        return json.dumps({"error": f"Failed to get git status: {exc}"})


@tool
def get_diff(
    scope: str = "working",
    path: str | None = None,
    session_id: str | None = None,
    max_chars: int = 20000,
) -> str:
    """Get a diff of the repository changes.

    Args:
        scope: "working" (unstaged), "staged", or "session" (patch session).
        path: Optional path to limit diff to a specific file or directory.
        session_id: Required when scope="session". The patch session ID.
        max_chars: Maximum total characters across all patches (default 20000).

    Returns:
        JSON object with summary and files array containing path, additions,
        deletions, and patch content. Per-file patches are truncated to
        max_chars with a note when truncated.
    """
    repo_root = _ACTIVE_REPO_ROOT.get()

    if scope not in ("working", "staged", "session"):
        return json.dumps({"error": f"Invalid scope: {scope}. Must be 'working', 'staged', or 'session'."})

    if scope == "session":
        if not session_id:
            return json.dumps({"error": "session_id is required when scope='session'"})
        return _get_session_diff(repo_root, session_id, max_chars)

    # Build git diff command
    cmd = ["git", "diff", "--no-color"]
    if scope == "staged":
        cmd.append("--cached")
    cmd.append("--stat")
    if path:
        cmd.append("--")
        cmd.append(path)

    try:
        res = subprocess.run(
            cmd,
            cwd=repo_root,
            capture_output=True,
            text=True,
            timeout=15,
        )
        if res.returncode != 0:
            return json.dumps({"error": f"git diff failed: {res.stderr}"})

        # Get the actual diff content
        diff_cmd = ["git", "diff", "--no-color"]
        if scope == "staged":
            diff_cmd.append("--cached")
        if path:
            diff_cmd.append("--")
            diff_cmd.append(path)

        diff_res = subprocess.run(
            diff_cmd,
            cwd=repo_root,
            capture_output=True,
            text=True,
            timeout=15,
        )
        if diff_res.returncode != 0:
            return json.dumps({"error": f"git diff failed: {diff_res.stderr}"})

        return _parse_diff_output(res.stdout, diff_res.stdout, max_chars, repo_root)
    except Exception as exc:
        return json.dumps({"error": f"Failed to get diff: {exc}"})


def _parse_diff_output(stat_output: str, diff_output: str, max_chars: int, repo_root: Path) -> str:
    """Parse git diff --stat and diff output into structured format."""
    # Parse --stat output for additions/deletions per file
    stat_lines = [line for line in stat_output.splitlines() if line.strip()]
    file_stats = {}
    for line in stat_lines:
        # Format: " file.py | 5 +++--"
        parts = line.split("|")
        if len(parts) != 2:
            continue
        file_path = parts[0].strip()
        stat_part = parts[1].strip()
        # Parse additions/deletions
        additions = 0
        deletions = 0
        for part in stat_part.split():
            if part.endswith("++"):
                try:
                    additions = int(part[:-2])
                except ValueError:
                    pass
            elif part.endswith("--"):
                try:
                    deletions = int(part[:-2])
                except ValueError:
                    pass

        # Normalize path
        file_path = file_path.replace("\\", "/")
        file_stats[file_path] = {"additions": additions, "deletions": deletions}

    # Parse diff output
    files = []
    total_chars = 0
    current_file = None
    current_patch = []

    for line in diff_output.splitlines():
        if line.startswith("diff --git a/"):
            # Save previous file
            if current_file:
                patch = "\n".join(current_patch)
                if total_chars + len(patch) > max_chars:
                    patch = patch[: max_chars - total_chars]
                    truncated = True
                else:
                    truncated = False
                stats = file_stats.get(current_file, {"additions": 0, "deletions": 0})
                files.append({
                    "path": current_file,
                    "additions": stats["additions"],
                    "deletions": stats["deletions"],
                    "patch": patch,
                    "truncated": truncated,
                })
                total_chars += len(patch)
                if total_chars >= max_chars:
                    break

            # Start new file
            match = re.search(r"diff --git a/(.+) b/(.+)", line)
            if match:
                current_file = match.group(2).replace("\\", "/")
            else:
                current_file = None
            current_patch = [line]
        elif current_file:
            current_patch.append(line)

    # Save last file
    if current_file and total_chars < max_chars:
        patch = "\n".join(current_patch)
        if total_chars + len(patch) > max_chars:
            patch = patch[: max_chars - total_chars]
            truncated = True
        else:
            truncated = False
        stats = file_stats.get(current_file, {"additions": 0, "deletions": 0})
        files.append({
            "path": current_file,
            "additions": stats["additions"],
            "deletions": stats["deletions"],
            "patch": patch,
            "truncated": truncated,
        })

    # Filter out blocked files
    files = [f for f in files if f["path"] not in _BLOCKED_FILE_NAMES]

    summary = f"scope: {len(files)} file(s) changed, {sum(f['additions'] for f in files)} additions, {sum(f['deletions'] for f in files)} deletions"

    return json.dumps({
        "summary": summary,
        "files": files,
    })


def _get_session_diff(repo_root: Path, session_id: str, max_chars: int) -> str:
    """Get diff for a patch session by reusing get_patch_session logic."""
    try:
        from .patching import get_patch_session
    except Exception as exc:
        return json.dumps({"error": f"Failed to import patching module: {exc}"})

    try:
        session = get_patch_session(session_id)
    except ValueError as exc:
        return json.dumps({"error": f"Session not found: {exc}"})

    changes = session.get("changes", [])
    files = []
    total_chars = 0

    for change in changes:
        path = change.get("path", "")
        if path in _BLOCKED_FILE_NAMES:
            continue

        # Get original content from checkpoint
        checkpoint_files = session.get("checkpoint", {}).get("files", {})
        original_content = checkpoint_files.get(path, "")

        # Get new content from change
        new_content = change.get("content", "")
        operation = change.get("operation", "modify")

        # Generate unified diff
        if operation == "delete":
            patch = _generate_delete_diff(path, original_content)
            additions = 0
            deletions = len(original_content.splitlines()) if original_content else 0
        elif operation == "create":
            patch = _generate_create_diff(path, new_content)
            additions = len(new_content.splitlines()) if new_content else 0
            deletions = 0
        else:  # modify
            patch = _generate_modify_diff(path, original_content, new_content)
            additions = len(new_content.splitlines()) if new_content else 0
            deletions = len(original_content.splitlines()) if original_content else 0

        if total_chars + len(patch) > max_chars:
            patch = patch[: max_chars - total_chars]
            truncated = True
        else:
            truncated = False

        files.append({
            "path": path,
            "additions": additions,
            "deletions": deletions,
            "patch": patch,
            "truncated": truncated,
        })
        total_chars += len(patch)
        if total_chars >= max_chars:
            break

    summary = f"session {session_id}: {len(files)} file(s) changed, {sum(f['additions'] for f in files)} additions, {sum(f['deletions'] for f in files)} deletions"

    return json.dumps({
        "summary": summary,
        "files": files,
    })


def _generate_delete_diff(path: str, original_content: str | None) -> str:
    if not original_content:
        return f"diff --git a/{path} b/{path}\ndeleted file mode 100644\n--- a/{path}\n+++ /dev/null\n"
    lines = original_content.splitlines(keepends=True)
    diff_lines = [f"diff --git a/{path} b/{path}", f"deleted file mode 100644", f"--- a/{path}", f"+++ /dev/null"]
    for line in lines:
        diff_lines.append(f"-{line.rstrip()}")
    return "\n".join(diff_lines) + "\n"


def _generate_create_diff(path: str, new_content: str | None) -> str:
    if not new_content:
        return f"diff --git a/{path} b/{path}\nnew file mode 100644\n--- /dev/null\n+++ b/{path}\n"
    lines = new_content.splitlines(keepends=True)
    diff_lines = [f"diff --git a/{path} b/{path}", f"new file mode 100644", f"--- /dev/null", f"+++ b/{path}"]
    for line in lines:
        diff_lines.append(f"+{line.rstrip()}")
    return "\n".join(diff_lines) + "\n"


def _generate_modify_diff(path: str, original: str | None, new: str | None) -> str:
    import difflib
    orig_lines = original.splitlines(keepends=True) if original else []
    new_lines = new.splitlines(keepends=True) if new else []

    diff = difflib.unified_diff(orig_lines, new_lines, fromfile=f"a/{path}", tofile=f"b/{path}")
    diff_lines = list(diff)
    if not diff_lines:
        return f"diff --git a/{path} b/{path}\n"
    return "".join(diff_lines)


def _detect_test_framework(target: Path) -> str:
    """Auto-detect test framework from project files."""
    # Check for Python test frameworks
    if (target / "pyproject.toml").exists() or (target / "pytest.ini").exists() or (target / "setup.cfg").exists() or (target / "tests").exists():
        return "pytest"
    # Check for Node.js test frameworks
    if (target / "package.json").exists():
        try:
            pkg = json.loads((target / "package.json").read_text())
            scripts = pkg.get("scripts", {})
            if "test" in scripts:
                if "vitest" in scripts["test"] or (target / "vitest.config.ts").exists() or (target / "vitest.config.js").exists():
                    return "vitest"
                return "jest"
        except Exception:
            pass
    return "pytest"  # default


def _run_pytest(target: Path, max_seconds: int) -> dict:
    """Run pytest and parse JUnit XML output."""
    with tempfile.NamedTemporaryFile(suffix=".xml", delete=False) as tmp:
        xml_path = tmp.name
    
    try:
        cmd = ["pytest", "--tb=short", "-q", f"--junitxml={xml_path}", str(target)]
        start = time.time()
        result = subprocess.run(
            cmd,
            cwd=target if target.is_dir() else target.parent,
            capture_output=True,
            text=True,
            timeout=max_seconds,
        )
        duration = time.time() - start
        
        # Parse JUnit XML
        passed = failed = skipped = 0
        failures = []
        
        if os.path.exists(xml_path):
            tree = ET.parse(xml_path)
            root = tree.getroot()
            
            for testcase in root.iter("testcase"):
                classname = testcase.get("classname", "")
                name = testcase.get("name", "")
                test_id = f"{classname}::{name}" if classname else name
                
                failure = testcase.find("failure")
                error = testcase.find("error")
                skipped_elem = testcase.find("skipped")
                
                if failure is not None:
                    failed += 1
                    msg = failure.get("message", "")
                    tb = failure.text or ""
                    failures.append({
                        "id": test_id,
                        "message": msg,
                        "traceback_tail": tb[-500:] if tb else "",
                    })
                elif error is not None:
                    failed += 1
                    msg = error.get("message", "")
                    tb = error.text or ""
                    failures.append({
                        "id": test_id,
                        "message": msg,
                        "traceback_tail": tb[-500:] if tb else "",
                    })
                elif skipped_elem is not None:
                    skipped += 1
                else:
                    passed += 1
        
        return {
            "framework": "pytest",
            "passed": passed,
            "failed": failed,
            "skipped": skipped,
            "duration_s": round(duration, 2),
            "failures": failures,
        }
    finally:
        if os.path.exists(xml_path):
            try:
                os.unlink(xml_path)
            except Exception:
                pass


def _run_vitest(target: Path, max_seconds: int) -> dict:
    """Run vitest and parse output."""
    try:
        cmd = ["npx", "vitest", "run", "--reporter=json", str(target)]
        start = time.time()
        result = subprocess.run(
            cmd,
            cwd=target if target.is_dir() else target.parent,
            capture_output=True,
            text=True,
            timeout=max_seconds,
        )
        duration = time.time() - start
        
        # Parse JSON output
        try:
            data = json.loads(result.stdout)
            test_results = data.get("testResults", [])
            passed = failed = skipped = 0
            failures = []
            
            for suite in test_results:
                for test in suite.get("tests", []):
                    if test.get("status") == "pass":
                        passed += 1
                    elif test.get("status") == "fail":
                        failed += 1
                        failures.append({
                            "id": test.get("name", ""),
                            "message": test.get("errors", [{}])[0].get("message", "") if test.get("errors") else "",
                            "traceback_tail": test.get("errors", [{}])[0].get("stack", "")[-500:] if test.get("errors") and test.get("errors")[0].get("stack") else "",
                        })
                    elif test.get("status") == "skip":
                        skipped += 1
            
            return {
                "framework": "vitest",
                "passed": passed,
                "failed": failed,
                "skipped": skipped,
                "duration_s": round(time.time() - start, 2),
                "failures": failures,
            }
        except Exception:
            # Fallback to parsing text output
            return _parse_text_test_output(result.stdout, "vitest", time.time() - start)
            
    except subprocess.TimeoutExpired:
        return {
            "framework": "vitest",
            "passed": 0,
            "failed": 1,
            "skipped": 0,
            "duration_s": max_seconds,
            "failures": [{"id": "timeout", "message": f"Test timed out after {max_seconds}s", "traceback_tail": ""}],
        }


def _run_jest(target: Path, max_seconds: int) -> dict:
    """Run jest and parse output."""
    try:
        cmd = ["npx", "jest", "--json", "--outputFile=/tmp/jest-results.json", str(target)]
        start = time.time()
        result = subprocess.run(
            cmd,
            cwd=target if target.is_dir() else target.parent,
            capture_output=True,
            text=True,
            timeout=max_seconds,
        )
        duration = time.time() - start
        
        # Read JSON output file
        json_path = "/tmp/jest-results.json"
        if os.path.exists(json_path):
            with open(json_path, "r") as f:
                data = json.load(f)
            try:
                os.unlink(json_path)
            except Exception:
                pass
            
            test_results = data.get("testResults", [])
            passed = failed = skipped = 0
            failures = []
            
            for suite in test_results:
                for test in suite.get("assertionResults", []):
                    if test.get("status") == "passed":
                        passed += 1
                    elif test.get("status") == "failed":
                        failed += 1
                        failures.append({
                            "id": test.get("fullName", ""),
                            "message": test.get("failureMessages", [""])[0] if test.get("failureMessages") else "",
                            "traceback_tail": test.get("stack", "")[-500:] if test.get("stack") else "",
                        })
                    elif test.get("status") == "pending":
                        skipped += 1
            
            return {
                "framework": "jest",
                "passed": passed,
                "failed": failed,
                "skipped": skipped,
                "duration_s": round(duration, 2),
                "failures": failures,
            }
        else:
            return _parse_text_test_output(result.stdout, "jest", duration)
            
    except subprocess.TimeoutExpired:
        return {
            "framework": "jest",
            "passed": 0,
            "failed": 1,
            "skipped": 0,
            "duration_s": max_seconds,
            "failures": [{"id": "timeout", "message": f"Test timed out after {max_seconds}s", "traceback_tail": ""}],
        }


def _parse_text_test_output(output: str, framework: str, duration: float) -> dict:
    """Fallback parser for text output."""
    lines = output.splitlines()
    passed = failed = skipped = 0
    failures = []
    
    for line in lines:
        if "PASSED" in line.upper() or "✓" in line:
            passed += 1
        elif "FAILED" in line.upper() or "✗" in line:
            failed += 1
        elif "SKIP" in line.upper():
            skipped += 1
    
    return {
        "framework": framework,
        "passed": passed,
        "failed": failed,
        "skipped": skipped,
        "duration_s": round(duration, 2),
        "failures": failures,
    }


@tool
def run_tests(target: str = ".", framework: str = "auto", max_seconds: int = 120) -> str:
    """Run tests and return structured results.
    
    Args:
        target: Path to test file or directory (default: current directory).
        framework: Test framework - "auto" (detect), "pytest", "vitest", or "jest".
        max_seconds: Maximum execution time in seconds (capped at 600).
    
    Returns:
        JSON string with: {framework, passed, failed, skipped, duration_s, failures:[{id, message, traceback_tail}]}.
    
    Auto-detects pytest (pyproject.toml/pytest.ini/tests dir) or vitest/jest (package.json scripts).
    Runs through sandbox executor when SANDBOX_ENABLED=true, otherwise host subprocess.
    """
    if max_seconds > 600:
        max_seconds = 600
    if max_seconds < 1:
        max_seconds = 1
    
    target_path = _resolve_repo_path(target)
    
    # Detect framework if auto
    if framework == "auto":
        framework = _detect_test_framework(target_path)
    
    # Run through sandbox or host
    try:
        from sandbox.executors import CommandExecutor
        executor = CommandExecutor()
        use_sandbox = executor.sandbox_enabled
    except Exception:
        use_sandbox = False
    
    if use_sandbox:
        # Run through sandbox executor
        cmd = _build_test_command(framework, target_path)
        executor = CommandExecutor()
        result = executor.run(" ".join(cmd), timeout=max_seconds)
        return json.dumps(result.to_dict())
    else:
        # Run directly on host
        if framework == "pytest":
            result = _run_pytest(target_path, max_seconds)
        elif framework == "vitest":
            result = _run_vitest(target_path, max_seconds)
        elif framework == "jest":
            result = _run_jest(target_path, max_seconds)
        else:
            return json.dumps({"error": f"Unknown framework: {framework}"})
        
        return json.dumps(result)


def _build_test_command(framework: str, target: Path) -> list[str]:
    """Build the test command for the given framework."""
    target_str = str(target)
    if framework == "pytest":
        return ["pytest", "--tb=short", "-q", f"--junitxml={tempfile.mktemp(suffix='.xml')}", target_str]
    elif framework == "vitest":
        return ["npx", "vitest", "run", "--reporter=json", target_str]
    elif framework == "jest":
        return ["npx", "jest", "--json", "--outputFile=/tmp/jest-results.json", target_str]
    return []


@tool
def run_command(command: str, timeout: int = 30) -> str:
    """Run a shell command in the sandboxed executor.

    Args:
        command: Command to execute (e.g., "pytest tests/", "git status", "python -c 'print(1)'").
        timeout: Maximum execution time in seconds (default 30).

    Returns:
        JSON string with execution result including stdout, stderr, exit_code, 
        and sandbox_enabled flag. If command requires approval, returns 
        {"status": "needs_approval", "id": "..."}.

    Allowed executables: python, pytest, node, npm (run/test/install/ci), git (read-only subcommands).
    Shell metacharacters (; && || | ` $() > <) are rejected.
    Commands not on the allowlist return {"status": "needs_approval", "id": "..."} 
    and require approval via POST /chat/tool-approvals/{id}/approve.
    """
    try:
        from sandbox.executors import CommandExecutor
    except Exception as exc:
        return json.dumps({"error": f"Failed to import CommandExecutor: {exc}"})

    executor = CommandExecutor()
    result = executor.run(command, timeout)
    return json.dumps(result.to_dict())


def _run_tool(cmd: list[str], cwd: Path, timeout: int = 60) -> tuple[int, str, str]:
    """Run a command and return (exit_code, stdout, stderr)."""
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=60,
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "Command timed out after 60s"
    except FileNotFoundError:
        return -1, "", f"Command not found: {cmd[0]}"
    except Exception as e:
        return -1, "", str(e)


def _parse_ruff_output(stdout: str, repo_root: Path) -> list[dict]:
    """Parse ruff JSON output into diagnostics."""
    diagnostics = []
    try:
        data = json.loads(stdout)
        for item in data:
            loc = item.get("location", {})
            diagnostics.append({
                "file": str(Path(item.get("filename", "")).relative_to(Path.cwd())),
                "line": loc.get("row", 1),
                "col": loc.get("column", 1),
                "severity": "error" if item.get("code", "").startswith("E") else "warning",
                "rule": item.get("code", ""),
                "message": item.get("message", ""),
            })
    except Exception:
        pass
    return diagnostics[:MAX_DIAGNOSTICS]


def _parse_eslint_output(stdout: str, repo_root: Path) -> list[dict]:
    """Parse eslint JSON output into diagnostics."""
    diagnostics = []
    try:
        data = json.loads(stdout)
        for file_result in data:
            filepath = str(Path(file_result.get("filePath", "")).relative_to(Path.cwd()))
            for msg in file_result.get("messages", []):
                diagnostics.append({
                    "file": filepath,
                    "line": msg.get("line", 1),
                    "col": msg.get("column", 1),
                    "severity": "error" if msg.get("severity", 1) == 2 else "warning",
                    "rule": msg.get("ruleId", ""),
                    "message": msg.get("message", ""),
                })
    except Exception:
        pass
    return diagnostics[:MAX_DIAGNOSTICS]


def _parse_tsc_output(stdout: str, repo_root: Path) -> list[dict]:
    """Parse tsc --noEmit output into diagnostics."""
    diagnostics = []
    import re
    pattern = re.compile(r"(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+TS(\d+):\s*(.+)")
    for line in stdout.splitlines():
        match = pattern.match(line.strip())
        if match:
            file, line, col, severity, rule, message = match.groups()
            diagnostics.append({
                "file": str(Path(file).relative_to(Path.cwd())),
                "line": int(line),
                "col": int(col),
                "severity": severity,
                "rule": f"TS{rule}",
                "message": message,
            })
    return diagnostics[:MAX_DIAGNOSTICS]


def _parse_npm_output(stdout: str, repo_root: Path) -> list[dict]:
    """Parse npm build output into diagnostics."""
    diagnostics = []
    import re
    patterns = [
        re.compile(r"(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(?:TS)?(\d+):\s*(.+)"),
        re.compile(r"(.+?):(\d+):(\d+):\s+(error|warning)\s+(?:TS)?(\d+):\s*(.+)"),
    ]
    for line in stdout.splitlines():
        for pattern in patterns:
            match = pattern.match(line.strip())
            if match:
                groups = match.groups()
                if len(groups) >= 5:
                    file, line, col, severity, rule, message = groups[:6]
                    diagnostics.append({
                        "file": str(Path(file).relative_to(Path.cwd())),
                        "line": int(line),
                        "col": int(col),
                        "severity": severity,
                        "rule": rule,
                        "message": message,
                    })
                    break
    return diagnostics[:MAX_DIAGNOSTICS]


@tool
def run_lint(paths: str = ".", tool: str = "auto") -> str:
    """Run linter and return normalized diagnostics.

    Args:
        paths: Comma-separated paths to lint (default: ".").
        tool: Linter to use - "auto" (detect), "ruff" (Python), "eslint" (JS/TS).

    Returns:
        JSON with {summary, diagnostics:[{file, line, col, severity, rule, message}]}.
        Capped at 200 diagnostics. Returns install command if tool not installed.
    """
    repo_root = _ACTIVE_REPO_ROOT.get()
    paths_list = [p.strip() for p in paths.split(",") if p.strip()]

    # Auto-detect tool
    if tool == "auto":
        py_files = any(repo_root.rglob("*.py"))
        ts_files = any(repo_root.rglob("*.ts")) or any(repo_root.rglob("*.tsx"))
        if py_files and not ts_files:
            tool = "ruff"
        elif ts_files and not py_files:
            tool = "eslint"
        elif py_files and ts_files:
            tool = "ruff"
        else:
            tool = "ruff"

    if tool not in LINT_TOOLS:
        return json.dumps({"error": f"Unknown linter: {tool}"})

    config = LINT_TOOLS[tool]
    diagnostics = []
    total_files = 0

    for path_str in paths_list:
        path = _resolve_repo_path(path_str)
        if not path.exists():
            continue

        if path.is_file():
            files = [path]
        else:
            if tool == "ruff":
                files = list(path.rglob("*.py"))
            elif tool == "eslint":
                files = list(path.rglob("*.ts")) + list(path.rglob("*.tsx")) + list(path.rglob("*.js")) + list(path.rglob("*.jsx"))
            else:
                files = []

        if not files:
            continue

        total_files += len(files)

        if tool == "ruff":
            cmd = config["cmd"] + [str(f.relative_to(Path.cwd())) for f in files]
            exit_code, stdout, stderr = _run_tool(cmd, Path.cwd())
            if exit_code == 127 or "not found" in stderr.lower() or "command not found" in stderr.lower():
                return json.dumps({
                    "error": f"ruff not installed. Install with: {config['install']}"
                })
            diagnostics = _parse_ruff_output(stdout, Path.cwd())
        elif tool == "eslint":
            cmd = config["cmd"] + [str(f.relative_to(Path.cwd())) for f in files]
            exit_code, stdout, stderr = _run_tool(cmd, Path.cwd())
            if exit_code == 127 or "not found" in stderr.lower():
                return json.dumps({
                    "error": f"eslint not installed. Install with: {config['install']}"
                })
            diagnostics = _parse_eslint_output(stdout, Path.cwd())
        else:
            continue

    diagnostics = diagnostics[:MAX_DIAGNOSTICS]

    summary = f"Linted {total_files} file(s) with {tool}: {len(diagnostics)} issue(s)"
    return json.dumps({
        "summary": summary,
        "tool": tool,
        "diagnostics": diagnostics,
    })


@tool
def run_build(target: str = "webview") -> str:
    """Run a build target and return normalized diagnostics.

    Args:
        target: Build target - "webview" (npm run build in webview-dev),
                "extension" (npm run build in apps/api/apps/ide-extension),
                or "tsc" for TypeScript type-check.

    Returns:
        JSON with {summary, diagnostics:[{file, line, col, severity, rule, message}]}.
        Capped at 200 diagnostics. Returns install command if tool not installed.
    """
    if target not in BUILD_TOOLS:
        return json.dumps({"error": f"Unknown build target: {target}. Available: {list(BUILD_TOOLS.keys())}"})

    config = BUILD_TOOLS[target]
    cwd = Path(config.get("cwd", "."))
    if not cwd.is_absolute():
        cwd = _ACTIVE_REPO_ROOT.get() / cwd

    if not cwd.exists():
        return json.dumps({"error": f"Build directory not found: {cwd}"})

    cmd = config["cmd"]
    exit_code, stdout, stderr = _run_tool(cmd, cwd)

    if exit_code == 127 or "not found" in stderr.lower() or "command not found" in stderr.lower():
        return json.dumps({
            "error": f"Required tool not found for {target}. Install with: {config['install']}"
        })

    parser_name = config.get("parser", "npm")
    if parser_name == "tsc":
        diagnostics = _parse_tsc_output(stdout + stderr)
    elif parser_name == "npm":
        diagnostics = _parse_npm_output(stdout + stderr, Path.cwd())
    else:
        diagnostics = []

    diagnostics = diagnostics[:MAX_DIAGNOSTICS]

    summary = f"Build {target}: {'succeeded' if exit_code == 0 else 'failed'} ({len(diagnostics)} diagnostic(s))"
    return json.dumps({
        "summary": summary,
        "target": target,
        "exit_code": exit_code,
        "diagnostics": diagnostics,
    })


def set_active_repo_root(path: str | Path):
    root = Path(path).expanduser().resolve()
    if not root.is_dir():
        raise ValueError("workspace root must be an existing directory")
    return _ACTIVE_REPO_ROOT.set(root)


def reset_active_repo_root(token) -> None:
    _ACTIVE_REPO_ROOT.reset(token)


workspace_tools = [search_code, read_code_file, get_git_status, find_files, get_diff, run_command, run_tests, run_lint, run_build]
