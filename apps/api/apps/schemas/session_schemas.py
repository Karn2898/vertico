from pydantic import BaseModel
from typing import Optional


class CreateSessionRequest(BaseModel):
    filename: str
    code: str
    workspace_root: Optional[str] = None
    llm_provider: str = "nvidia"
    llm_api_key: Optional[str] = None
    llm_model: Optional[str] = None
    graph: str = "refactor"
    # speed mode: "fast" (cheaper/faster) or "thorough" (full quality)
    mode: str = "fast"


class SessionResponse(BaseModel):
    session_id: str
    filename: str
    status: str
    iterations: int
    errors: Optional[str]
    created_at: str
    llm_provider: str = "nvidia"
    llm_model: Optional[str] = None
    mode: str = "fast"


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
    mode: str = "fast"