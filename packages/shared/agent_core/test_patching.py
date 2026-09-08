import json

import pytest

from agent_core.patching import (
    apply_patch_session,
    create_patch_session,
    prepare_patch_session,
    reject_patch_session,
)
from agent_core.workspace_tools import REPO_ROOT


def test_patch_session_requires_approval_and_restores_created_file():
    relative_path = "packages/shared/agent_core/_patching_probe.py"
    path = REPO_ROOT / relative_path
    path.unlink(missing_ok=True)
    plan = {
        "status": "proposed",
        "changes": [
            {
                "path": relative_path,
                "operation": "create",
                "patch": "full content",
                "content": "value = 1\n",
                "reason": "test patch application",
            }
        ],
    }

    session = create_patch_session(plan)
    with pytest.raises(PermissionError):
        apply_patch_session(session["session_id"])
    assert not path.exists()

    applied = apply_patch_session(session["session_id"], approved=True)
    assert applied["status"] == "applied"
    assert path.read_text(encoding="utf-8") == "value = 1\n"

    rejected = reject_patch_session(session["session_id"])
    assert rejected["status"] == "rejected"
    assert not path.exists()


def test_rejecting_pending_session_does_not_create_files():
    relative_path = "packages/shared/agent_core/_pending_probe.py"
    path = REPO_ROOT / relative_path
    path.unlink(missing_ok=True)
    session = create_patch_session(
        {
            "status": "proposed",
            "changes": [
                {
                    "path": relative_path,
                    "operation": "create",
                    "patch": "full content",
                    "content": "value = 2\n",
                }
            ],
        }
    )

    result = reject_patch_session(session["session_id"])
    assert result["status"] == "rejected"
    assert not path.exists()


def test_prepare_tool_returns_approval_session_without_applying():
    result = prepare_patch_session.invoke(
        {
            "plan_json": '{"status": "proposed", "changes": [{"path": "packages/shared/agent_core/_tool_probe.py", "operation": "create", "patch": "full content", "content": "value = 3\\n"}]}'
        }
    )

    prepared = json.loads(result)
    assert prepared["status"] == "awaiting_approval"
    reject_patch_session(prepared["session_id"])
