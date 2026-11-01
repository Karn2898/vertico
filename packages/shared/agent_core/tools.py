import json
import os
import subprocess
import sys

from langchain_core.tools import tool
from .config import llm
from .workspace_tools import workspace_tools, _resolve_repo_path
from .planning import build_patch_plan, plan_file_changes
from .patching import prepare_patch_session, create_patch_session
from .ast_refactor import ast_refactor
from .symbol_index import find_symbol, find_references, get_call_graph
from .ui_screenshot import screenshot_ui, compare_screenshots
from .benchmarks import snapshot_files, diff_snapshot, benchmark
from .local_api import call_local_api
from .dependency_check import check_dependencies

try:
    from sandbox.executors.python_executor import PythonExecutor
except Exception:
    PythonExecutor = None


_python_executor = PythonExecutor() if PythonExecutor is not None else None

if _python_executor is not None and not _python_executor.sandbox_enabled:
    import logging

    logging.getLogger(__name__).warning(
        "Running UNSANDBOXED: code execution falls back to a plain subprocess. "
        "Set SANDBOX_ENABLED=true and build the sandbox image for isolation."
    )


def _execution_mode() -> str:
    """Report the active execution mode: docker sandbox, subprocess fallback, or none."""
    if _python_executor is None:
        return "unavailable"
    if _python_executor.sandbox_enabled:
        return "docker-sandbox"
    return "subprocess-fallback"


@tool
def write_python_file(filename: str, code: str):
    """Writes a Python file with the given filename and code.

    Args:
        filename (str): The name of the Python file to be created.
        code (str): The code to be written into the Python file.

    Use this once you have finished refactoring. The write is staged as a
    patch plan that must be approved before it is applied to disk.
    """
    if not filename.endswith(".py"):
        filename += ".py"

    try:
        resolved = _resolve_repo_path(filename)
    except ValueError as exc:
        return f"write rejected: {exc}"

    plan = build_patch_plan(
        [
            {
                "path": str(resolved.relative_to(_resolve_repo_path("."))).replace("\\", "/"),
                "operation": "create" if not resolved.exists() else "modify",
                "content": code,
                "reason": "write_python_file tool call",
            }
        ]
    )
    session = create_patch_session(plan)
    return json.dumps(
        {
            "message": "File write staged for approval. Nothing was written to disk.",
            **session,
        }
    )


@tool
def execute_python_file(filename: str):
    """Executes a python file with the given filename.
    Returns the output or error. Use this to verify the refactored code runs.
    """
    try:
        resolved = _resolve_repo_path(filename)
    except ValueError as exc:
        return f"failed to run : {str(exc)}"

    try:
        code = resolved.read_text(encoding="utf-8")
    except Exception as e:
        return f"failed to run : {str(e)}"

    if _python_executor is not None:
        try:
            result = _python_executor.run(code, timeout=5)
            mode = "sandboxed" if result.sandbox_enabled else "dev-subprocess"

            if result.timed_out:
                return f"[{mode}] Execution timed out"
            if result.success:
                return f"[{mode}] Success:\n{result.stdout}"
            return f"[{mode}] Error (exit {result.exit_code}):\n{result.stderr}"
        except Exception:
            pass

    try:
        result = subprocess.run(
            ["python3", str(resolved)],
            capture_output=True,
            text=True,
            timeout=5,
        )

        if result.returncode == 0:
            return f"[dev-subprocess] Success:\n{result.stdout}"
        return f"[dev-subprocess] Error (exit {result.returncode}):\n{result.stderr}"
    except Exception as e:
        return f"failed to run : {str(e)}"


@tool
def semantic_search(query: str, top_k: int = 8):
    """Search the indexed repository semantically via the pgvector index.

    Returns matching code chunks as a JSON list of
    {path, start_line, end_line, snippet, score}.
    If the repository has not been indexed yet, returns a message asking
    the user to run "Vertico: Index Repo" first.

    Args:
        query (str): Natural-language search query.
        top_k (int): Maximum number of chunks to return.
    """
    if not query.strip():
        raise ValueError("query must not be empty")
    if top_k < 1 or top_k > 50:
        raise ValueError("top_k must be between 1 and 50")

    repo_root = str(_resolve_repo_path("."))

    try:
        import os
        rag_pkg_root = os.path.join(os.path.dirname(__file__), "..", "..", "RAG")
        rag_pkg_root = os.path.abspath(rag_pkg_root)
        if rag_pkg_root not in sys.path:
            sys.path.insert(0, rag_pkg_root)
        from db.database import engine
        from db.repositories.embedding_repo import EmbeddingRepo
        from embedder.RAG_embedders import embed_query
        from rerankers.reranker import rerank
        from sqlmodel import Session
    except Exception as e:
        return f"semantic search unavailable: {e}"

    try:
        with Session(engine) as db_session:
            repo = EmbeddingRepo(db_session)
            if not repo.is_indexed(repo_root):
                return (
                    "Repository is not indexed yet. "
                    'Ask the user to run "Vertico: Index Repo" first, '
                    "then retry semantic search."
                )

            query_vector = embed_query(query)
            raw_results = repo.similarity_search(
                query_embedding=query_vector,
                repo_path=repo_root,
                top_k=max(top_k * 2, top_k),
            )
    except Exception as e:
        return f"semantic search failed: {e}"

    reranked = rerank(query, raw_results, top_k=top_k)
    results = [
        {
            "path": str(_resolve_repo_path(r["file_path"]).relative_to(_resolve_repo_path("."))).replace("\\", "/"),
            "start_line": r["start_line"],
            "end_line": r["end_line"],
            "snippet": r["content"],
            "score": r["score"],
        }
        for r in reranked
    ]
    return json.dumps(results)


tools = [
    write_python_file,
    execute_python_file,
    *workspace_tools,
    plan_file_changes,
    prepare_patch_session,
    semantic_search,
    ast_refactor,
    find_symbol,
    find_references,
    get_call_graph,
    screenshot_ui,
    compare_screenshots,
    snapshot_files,
    diff_snapshot,
    benchmark,
    call_local_api,
    check_dependencies,
]
llm_with_tools = llm.bind_tools(tools)
