from fastapi import APIRouter
from datetime import datetime
import sys
import os

router= APIRouter(prefix="/health",tags=["health"])

try:
    from db.database import engine
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    checks["db"]="ok"
except Exception as e:
    checks["db"]=f"error : {str(e)}"

@router.get("/")
def health_check():
    return{
        "status":"ok",
        "timestamp":datetime.utcnow().isoformat() ,
    }

@router.get("/ready")
def readiness_check():
    """
    Readiness check — are all dependencies available?
    Checks: LLM config, session store, chat store.
    Add DB ping here once you wire db/ in.
    """
    checks={}

    try:
        from agent_core.config import llm
        checks["llm"]="ok" if llm else "missing"
    except Exception as e :
        checks["llm"]=f"error: {str{e}}"

    has_key=bool(
        os.environ.get("NVIDIA_API_KEY")
    )
    checks["api_key"]="ok" if has_key else "missing"

    try:
        from .sessions import sessions
        checks["sessions_store"]=f"error : {str(e)}"
    except Exception as e:
        checks["sessions_store"]=f"error: {str(e)}"

    try:
        from .chat import chat_histories
        checks["chat_store"]="ok"
    except Exception as e:
        checks["chat_store"]=f"error: {str(e)}"

    all_ok =all(v == "ok" for v in checks.values())

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
        app=graphs.workflow.compile()
        nodes=list(app.nodes.keys())
        return{
            "status":"ok",
            "nodes":nodes,
            "timestap":datetime.utcnow().isoformat(),
        }
    except Exception as e :
        return{
            "status":"error",
            "error":str(e),
            "timestamp":datetime.utcnow().isoformat(),
        }
    
try:
    from sandbox.executors.python_executor import PythonExecutor
    ex = PythonExecutor()
    result = ex.run("print('ok')", timeout=5)
    checks["sandbox_python"] = "ok" if result.success else f"error: {result.stderr}"
except Exception as e:
    checks["sandbox_python"] = f"error: {str(e)}"