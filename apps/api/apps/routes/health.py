from fastapi import APIRouter
from datetime import datetime
import sys
import os
from pathlib import Path

router = APIRouter(prefix="/health", tags=["health"])

# Ensure top-level packages (db, agent_core, sandbox) are importable.
_repo_root = Path(__file__).resolve().parents[4]
_packages_root = _repo_root / "packages"
for p in (
    str(_repo_root),
    str(_packages_root),
    str(_repo_root / "packages" / "db"),
    str(_repo_root / "packages" / "shared"),
):
    if p not in sys.path:
        sys.path.insert(0, p)


@router.get("/")
def health_check():
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/ready")
def readiness_check():
    """
    Readiness check — are all dependencies available?
    """
    checks = {}

    try:
        from db.database import engine
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        checks["db"] = "ok"
    except Exception as e:
        checks["db"] = f"error: {str(e)}"

    try:
        from agent_core.config import llm
        checks["llm"] = "ok" if llm else "missing"
    except Exception as e:
        checks["llm"] = f"error: {str(e)}"

    checks["api_key"] = "ok" if os.environ.get("NVIDIA_API_KEY") else "missing"

    try:
        from ..services.session_service import sessions
        checks["sessions_store"] = "ok" if sessions is not None else "missing"
    except Exception as e:
        checks["sessions_store"] = f"error: {str(e)}"

    try:
        from .chat import chat_histories
        checks["chat_store"] = "ok" if chat_histories is not None else "missing"
    except Exception as e:
        checks["chat_store"] = f"error: {str(e)}"

    all_ok = all(v == "ok" for v in checks.values())

    return {
        "status": "ready" if all_ok else "degraded",
        "checks": checks,
        "timestamp": datetime.utcnow().isoformat(),
        "python": sys.version,
    }


@router.get("/graph")
def graph_check():
    try:
        from agent_core import graphs
        app = graphs.workflow.compile()
        nodes = list(app.nodes.keys())
        return {
            "status": "ok",
            "nodes": nodes,
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat(),
        }


try:
    from sandbox.executors.python_executor import PythonExecutor
    ex = PythonExecutor()
    result = ex.run("print('ok')", timeout=5)
    _sandbox_status = "ok" if result.success else f"error: {result.stderr}"
except Exception as e:
    _sandbox_status = f"error: {str(e)}"
