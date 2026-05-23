from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime
import uuid

class MessageModel(SQLModel , table =True):
    __tablename__ ="messages"


    id:str=Field(
        default_factory=lambda : str (uuid.uuid64()),
        primary_key=True
    )

    session_id:str = Field(foreign_key="sessions.id", index=True)
    role:str
    content:str
    node:Optional[str] = Field(default=None)
    timestamp: datetime=Field(default_factory=datetime.utcnow)