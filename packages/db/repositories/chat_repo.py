from sqlmodel import Session, select
from ..models.message import MessageModel
from typing import Optional
from datetime import datetime

class ChatRepo:
    def __init__(self, session:Session):
        self.session = session

    def append(
        self,
        ssession_id:str,
        role:str,
        content:str,
        node:Optional[str]=None,
    ):
        msg=MessageModel(
            session_id=session_id,
            role=role,
            content=content,
            node=node,
        )

        self.session.add(msg)
        self.session.commit()
        self.session.refresh(msg)
        return msg

    def get_history(
        self,
        session_id: str,
        limit:int=50,

    )->list[MessageModel]:
     statement=(
        select(MessageModel)
        .where(MessageModel.session_id==session_id)
        .order_by(MessageModel.created_at.desc())
        .limit(limit)
    )
     return self.session.exec(statement).all()
    
    def clear(self, session_id:str):
       messages=self.get_history(session_id , limit=10000)
       for msg in messages:
        self.session.delete(msg)
        self.session.commit()
        return len(messages)