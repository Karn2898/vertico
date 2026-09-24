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
        
        # If original_code looks like a placeholder, use the latest user message from chat history
        # (This is a fallback - the chat endpoint should update this properly)
        placeholder_indicators = ["paste code", "untitled", "refactor"]
        if any(ind in initial_state["original_code"].lower() for ind in placeholder_indicators):
            # Try to get the latest user message from chat history
            pass  # TODO: fetch from chat history if needed

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
