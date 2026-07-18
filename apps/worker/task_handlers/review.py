from agent_core.graphs import review_graph
from db.repositories.session_repo import SessionRepo
from sqlmodel import Session
from db.database import engine
import logging

logger = logging.getLogger(__name__)


def handle_review(session_id: str):
    with Session(engine) as db:
        repo = SessionRepo(db)
        session = repo.get(session_id)

        if not session:
            raise ValueError(f"Session not found :{session_id}")

        initial_state = {
            "original_code": session.original_code,
            "review_notes": "",
        }

        repo.update_status(session_id, "running")
        logger.info(f"[review] starting session {session_id}")

    app = review_graph.compile()
    result = app.invoke(initial_state)

    with Session(engine) as db:
        repo = SessionRepo(db)
        repo.update_agent_state(
            session_id,
            review_notes=result.get("review_notes"),
            status="done",
        )

    logger.info(f"[review] completed session {session_id}")
    return {"session_id": session_id, "status": "done"}