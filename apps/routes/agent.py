from fastapi import APIRouter

router = APIRouter()
sessions = {}

@router.post("/agent/run/{session_id}")
async def run_agent(session_id: str):
    session = sessions[session_id]

    sessions[session_id]["status"] = "running"

    app = graphs.workflow.compile()
    result = app.invoke(session["agent_state"])

    sessions[session_id]["agent_state"].update(result)
    sessions[session_id]["status"] = "done"

    return {"session_id": session_id, "status": "done"}