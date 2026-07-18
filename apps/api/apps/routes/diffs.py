from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import difflib

from ..services.session_service import sessions
from .session import _require

router = APIRouter(prefix="/diffs", tags=["diffs"])

class DiffRequest(BaseModel):
    original: str
    refactored: str
    unified: str
    filename : str
    lines_added: int
    lines_removed: int

class DiffResponse(BaseModel):
    session_id: str
    filename: str 
    has_changes : bool
    diff : Optional[DiffHunk]
    status: str

class AcceptRejectRequest(BaseModel):
    session_id: str

diff_status : dict[str , str ]={}

@router.get("/{session_id}", response_model =DiffResponse)
def get_diff(session_id : str):
    """
    Get the full diff between original and refactored code.
    This is what the IDE extension renders in the diff viewer.
    """
    _require(session_id)
    session=sessons[session_id]
    state=session["agent_state"]

    original=state.get("original_code","")
    refactored=state.get("refactored_code","")
    filename= session.get("filename","unknown.py")

    if not refactored or original == refactored:
        return DiffResponse(
            session_id= session_id,
            filename=filename,
            has_changes=False ,
            diff =None,
            status=diff_status.get(session_id , "pending")

        )

    hunk=_build_hunk(original , refactored , filename)

    return DiffResponse(
        session_id =session_id,
        filename = filename,
        has_changes = True,
        diff = hunk ,
        status= diff_status.get(session_id , "pending")

    )
@router.get("/{session_id}/preview")
def preview_diff(session_id: str):
    """
    Get a simple unified diff string for quick preview in the IDE.
    """
    _require(session_id)
    session = sessions[session_id]
    state = session["agent_state"]

    original = state.get("original_code", "")
    refactored = state.get("refactored_code", "") 
    filename=session.get("filename", "unknown.py")

    unified=_unified_diff(original ,refactored , filename)
   return {"session_id": session_id , "preview":unified}

@router.post("/{session_id}/accept")
def accept_diff(session_id:str):
    """
    User accepted the refactored code.
    - Marks diff as accepted
    - Overwrites original_code with refactored_code in session state
      so future runs start from the accepted version
    - The write_python_file tool already wrote to disk during graph run
    """
    _require(session_id)
    session=sessions[session_id]
    state=session["agent_state"]

    refactored=state.get("refactored_code")

    if not refactored:
        raise HTTPException(status_code=400, detail="No refactored code to accept")
    
    sessions[session_id]["agent_state"]["iterations"]=0
    sessions[session_id]["agent_state"]["errors"]=None
    sessions[session_id]["agent_state"]["review_notes"]=""

    diff_status[session_id]="accepted"

    return{
        "session_id": session_id,
        "status": "accepted",
        "message": "Refactored code is now the new baseline."
    }

@router.post("/{session_id}/reject")
def reject_diff(session_id:str):
    """
    User rejected the refactored code.
    - Marks diff as rejected
    - Restores refactored_code back to original_code in session
    - Deletes the written file if it exists on disk
    """
    _require(session_id)
    session = sessions[session_id]
    state = session["agent_state"]

    original = state.get("original_code", "")
    filename = session.get("filename", "")

    sessions[session_id]["agent_state"]["refactored_code"] = original
    sessions[session_id]["agent_state"]["iterations"] = 0
    sessions[session_id]["agent_state"]["errors"] = None
    sessions[session_id]["agent_state"]["review_notes"] = ""

    import os 
    if filename and os.path.exists(filename):
        os.remove(filename)

    diff_status[session_id]="rejected"
    return{
         "session_id": session_id,
        "status": "rejected",
        "message": "Rolled back to original code."
    }

#helpers

def _unified_diff(original:str , refactored : str , filename : str ):
    """Generate a unified diff string between original and refactored code."""
    original_lines=original.spitlines(keepends=True)
    refactored_lines=refactored.splitlines(keepends=True)

    diff=dfflib.unified_diff(
        original_lines,
        refactored_lines,
        fromfile=f"original/{filename}",
        tofile=f"refactored/{filename}",
        lineterm=""
    )

    return "".join(diff)

def build_hunk(original:str , refactored:str , filename:Str ):
    unified=_unified_diff(original , refactored , filename)

    lines_added=sum(
        1 for line in unified.splitlines()
        if line.startswith("+") and not line.startswith("+++")

    )

    lines_removed=sum(
        1 for line in unified.splitlines()
        if line.startswith("-") and not line.startswith("---")

    )

    return DiffHunk(
        original = original ,
        refactored = refactored ,
        unified =unified , 
        filename= filename,
        lines_added=lines_added,
        lines_removed=lines_removed ,
    )