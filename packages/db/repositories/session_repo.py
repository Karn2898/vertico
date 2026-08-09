from datetime import datetime
from typing import Optional

from fastapi import HTTPException
from sqlmodel import Session, select

from ..models.session import SessionModel


class SessionRepo:
    def __init__(self, session: Session):
        self.session = session

    def create(
        self,
        filename: str,
        original_code: str,
        graph: str = "refactor",
        llm_provider: str = "nvidia",
        llm_api_key: Optional[str] = None,
        llm_model: Optional[str] = None,
    ) -> SessionModel:
        db_session = SessionModel(
            filename=filename,
            original_code=original_code,
            refactored_code=original_code,
            graph=graph,
            llm_provider=llm_provider,
            llm_api_key=llm_api_key,
            llm_model=llm_model,
            created_at=datetime.utcnow(),
        )
        self.session.add(db_session)
        self.session.commit()
        self.session.refresh(db_session)
        return db_session

    def get(self, session_id: str) -> Optional[SessionModel]:
        return self.session.get(SessionModel, session_id)

    def get_all(self) -> list[SessionModel]:
        return self.session.exec(select(SessionModel)).all()

    def update_status(self, session_id: str, status: str) -> SessionModel:
        db_session = self._require(session_id)
        db_session.status = status
        self.session.add(db_session)
        self.session.commit()
        self.session.refresh(db_session)
        return db_session

    def update_agent_state(
        self,
        session_id: str,
        refactored_code: Optional[str] = None,
        review_notes: Optional[str] = None,
        errors: Optional[str] = None,
        iterations: Optional[int] = None,
        status: Optional[str] = None,
    ) -> SessionModel:
        db_session = self._require(session_id)

        if refactored_code is not None:
            db_session.refactored_code = refactored_code
        if review_notes is not None:
            db_session.review_notes = review_notes
        if errors is not None:
            db_session.errors = errors
        if iterations is not None:
            db_session.iterations = iterations
        if status is not None:
            db_session.status = status

        self.session.add(db_session)
        self.session.commit()
        self.session.refresh(db_session)
        return db_session

    def accept_diff(self, session_id: str) -> SessionModel:
        db_session = self._require(session_id)
        db_session.original_code = db_session.refactored_code
        db_session.review_notes = ""
        db_session.errors = None
        db_session.iterations = 0
        db_session.status = "idle"
        self.session.add(db_session)
        self.session.commit()
        self.session.refresh(db_session)
        return db_session

    def reject_diff(self, session_id: str) -> SessionModel:
        db_session = self._require(session_id)
        db_session.refactored_code = db_session.original_code
        db_session.review_notes = ""
        db_session.errors = None
        db_session.iterations = 0
        db_session.status = "idle"
        self.session.add(db_session)
        self.session.commit()
        self.session.refresh(db_session)
        return db_session

    def delete(self, session_id: str) -> SessionModel:
        db_session = self._require(session_id)
        self.session.delete(db_session)
        self.session.commit()
        return db_session

    def _require(self, session_id: str) -> SessionModel:
        db_session = self.session.get(SessionModel, session_id)
        if not db_session:
            raise HTTPException(status_code=404, detail="session not found")
        return db_session