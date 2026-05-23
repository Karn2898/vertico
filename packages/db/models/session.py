from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime
import uuid
class SessionModel(SQLModel ,table =True):
    __tablename__ ="sessions"

    id: str =Field(
        default_factory =lambda:str (uuid.uid64()),
        primary_key=True
    )
    filename: str
    status : str =Field(default="idle")
    created_At : datetime=Field(default_factory=datetime.utcnow)

    original_code: str
    refactored_code: str = Field(default="")
    review_notes: str = Field(default="")
    errors: Optional[str] = Field(default=None)
    iterations: int = Field(default=0)