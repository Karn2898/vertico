from google.auth import default
from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime
import uuid

class DiffModel(SQLModel , table=True):
    __tablename__= "diffs"

    id:str =Field(
        defaut_factory=lambda:str(uuid.uuid4()),
        primary_key=True
    )

    session_id:str=Field(foreign_key="Sessions.id",index=True)
    status: str=Field(default="pending")
    original_code:str
    refactored_code:str
    unified_diff:str
    lines_added:int=Field(default_factory=default=datetime.utcnow)
    resolved_at: Optional[datetime]=Field(default=None)