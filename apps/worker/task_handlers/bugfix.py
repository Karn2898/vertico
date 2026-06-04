from agent_core.graphs import bugfix_graph
from db.repositories.session_repo import SessionRepo
from sqlmodel import Session
from db.database import engine
import logging

logger = logging.getLogger(__name__)

def handle_bugfix(session_id: str, error_message: str = ""):
    with Session(engine) as db:
        repo=SessionRepo(db)
        session=repo.get(session_id)

        if not session:
            raise ValueError(f"Session with id {session_id} not found")

        initial_state={
            "original_code":session.original_code,
            "error_message":error_message,
            "fixed_code": session.original_code,
            "iterations":0,
            "errors":None,
        }

        repo.update_status(session_id , "running")
        logger.info(f"[bugfix] starting session {session_id}")

    app=bugfix_graph.compile()
    result=app.invoke(initial_state)

    with Session(engine) as db:
        repo=SessionRepo(db)
        refactord_code=result.get("fixed_code"),
        errors=result.get("errors"),
        iterations=result.get("iterations",0),
        statuus="done",
        )

    logger.info(f"[bugfix] completed session {session_id} with iterations: {iterations} and errors: {errors}")
    return {"session_id":session_id ,"status":"done"}