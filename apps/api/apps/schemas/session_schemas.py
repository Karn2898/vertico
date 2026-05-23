from pydantic import BaseModel
from typing import Optional


class CreateSessionRequest(BaseModel):
    filename: str
    original_code: str


class SessionResponse(BaseModel):
    session_id: str
    filename: str
    status: str
    iterations: int
    errors: Optional[str]
    created_at: str


class SessionStateResponse(BaseModel):
    session_id: str
    original_code: str
    review_notes: str
    refactored_code: str
    errors: Optional[str]
    iterations: int
    status: str