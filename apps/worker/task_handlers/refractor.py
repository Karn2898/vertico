from agent_core.graphs import workflow as refactor_workflow
from db.repositories.session_repo import SessionRepo
from sqlmodel import Session
from db.database import engine
import logging

def handle_refactor(session_id: str):
    with Session(engine) as db:
        repo=SessionRepo(db)
        session=repo.get(session_id)

        if not session:
            raise ValueError(f"session not found :{session_id}")

        initial_state={
            "original_code":session.original_code,
            "review_notes":session.review_notes,
            "refactored_code":session.refactored_code,
            "errors":session.errors,
            "iterations":session.iterations,
        }

        repo.update_status(session_id, "running")

        app = refactor_workflow.compile()
        result = app.invoke(initial_state)

        with Session(engine) as db:
            repo=SessionRepo(db)
            repo.update_agent_state(
                session_id,
                refactored_code=result.get("refactored_code"),
                review_notes=result.get("review_notes"),
                errors=result.get("iterations",0),
                status="done",
            )
    logger.info(f"[refactor] completed session {session_id}")
    return {"session_id": session_id , "status":"done"}
