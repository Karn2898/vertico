from datetime import datetime
from typing import Optional
import uuid

from sqlmodel import SQLModel, Field


class SessionModel(SQLModel, table=True):
    __tablename__ = "sessions"

    id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        primary_key=True,
    )
    filename: str
    graph: str = Field(default="refactor")
    status: str = Field(default="idle")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    llm_provider: str = Field(default="nvidia")
    llm_api_key: Optional[str] = Field(default=None)
    llm_model: Optional[str] = Field(default=None)

    original_code: str
    refactored_code: str = Field(default="")
    review_notes: str = Field(default="")
    errors: Optional[str] = Field(default=None)
    iterations: int = Field(default=0)