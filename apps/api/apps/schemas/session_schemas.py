from pydantic import BaseModel
from typing import Optional


class CreateSessionRequest(BaseModel):
    filename: str
    code: str
    llm_provider: str = "nvidia"
    llm_api_key: Optional[str] = None
    llm_model: Optional[str] = None
    graph: str = "refactor"


class SessionResponse(BaseModel):
    session_id: str
    filename: str
    status: str
    iterations: int
    errors: Optional[str]
    created_at: str
    llm_provider: str = "nvidia"
    llm_model: Optional[str] = None


class SessionStateResponse(BaseModel):
    session_id: str
    original_code: str
    review_notes: str
    refactored_code: str
    errors: Optional[str]
    iterations: int
    status: str
    llm_provider: str = "nvidia"
    llm_model: Optional[str] = None