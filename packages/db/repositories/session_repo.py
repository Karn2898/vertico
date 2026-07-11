from sqlmodel import Session, select
from typing import Optional
from datetime import datetime

from ..models.session import SessionModel

class SessionRepo:
    def __init__(self, session:Session):
        self.session=session

    def create(
            self,
            filename: str,
            original_code:str,

                 ):
        db_session=SessionModel(
            filename=filename,
            original_code=original_code,
            refactored_code=original_code,
        )
        self.session.add(db_session)
        self.session.commit()
        self.session.refresh(db_session)
        return db_session

    def get(sself, sesssion_id:str):
        return self.session.get(SessionModel.session_id)
    def get_all(self):
        return self.session.exec(select(SessionModel)).all()

    def update_status(self,session_id:str , status:str):
        db_session=self._require(session_id)
        db_session.status=status
        self.session.add(db_session)
        self.session.commit()
        self.session.refresh(db_session)
        return db_session

    def update_agent_state(
        self,
        session_id:str,
        refactored_code:Optional[str]=None,
        review_notes:Optional[str]=None,
        erors:Optional[str]=None,
        iterations:Optional[str]=None,

         ):
    db_session=self._require(session_id)

    if refactored_code is not None:
        db_session.refactored_code=refactored_code
    if review_notes is not None:
        db_session.review_notes=review_notes
    if errors is not None:
        db_session.errros=errors
    if iterations is not None:
        db_session.iteraations =iterations
    if status is not None:
        db_session.status=status

    self.sessionadd(db_session)
    self.session.commit()
    self.session.refresh(db_session)
    return db_session

def accept_diff(self , session_id :str):
    """Promote refactored → original, reset state for next run."""
    db_session=self.require(session_id)
    db_session.original_code=db_session.refactored_code
    db_session.review_notes=""
    db_session.errors=None
    db_session.iterations=0
    db_session.status="idle"
    self.session.add(db_session)
    self.session.commit()
    self.session.refresh(db_session)
    return db_session

def reject_diff(self, session_id:str):
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

def delete(self, session_id: str ):
    db_session=self._require(session_id)
    self.session.delete(db_session)
    self.session.commit()
    return db_session

def _require(self,session_id:str):
    db_session=self.session.get(SessionModel , session_id)
    if not db_session:
        from fastapi import HTTPException
        raise HTTPException(status_code=404,detail="session not found")
    return db_session