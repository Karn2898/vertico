from datetime import datetime
from typing import Optional
import uuid

from sqlmodel import SQLModel, Field


class MessageModel(SQLModel, table=True):
    __tablename__ = "messages"

    id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        primary_key=True,
    )

    session_id: str = Field(foreign_key="sessions.id", index=True)
    role: str
    content: str
    node: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)