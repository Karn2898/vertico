from datetime import datetime
from typing import Optional
import uuid

from sqlmodel import SQLModel, Field


class DiffModel(SQLModel, table=True):
    __tablename__ = "diffs"

    id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        primary_key=True,
    )

    session_id: str = Field(foreign_key="sessions.id", index=True)
    status: str = Field(default="pending")
    original_code: str
    refactored_code: str
    unified_diff: str
    lines_added: int = Field(default=0)
    resolved_at: Optional[datetime] = Field(default=None)