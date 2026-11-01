from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from sandbox.executors import approve_command, reject_command, get_approval_status

router = APIRouter(prefix="/chat/tool-approvals", tags=["tool-approvals"])


class ApproveRequest(BaseModel):
    approved: bool = True


@router.get("/{approval_id}")
def get_approval(approval_id: str):
    """Get the status of a pending tool approval."""
    result = get_approval_status(approval_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.post("/{approval_id}/approve")
def approve_tool(approval_id: str, request: ApproveRequest):
    """Approve or reject a pending tool command."""
    if request.approved:
        result = approve_command(approval_id)
    else:
        result = reject_command(approval_id)
    
    if result.exit_code != 0:
        raise HTTPException(status_code=400, detail=result.stderr)
    
    return result.to_dict()