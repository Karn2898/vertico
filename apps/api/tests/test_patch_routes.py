import json

import pytest

from apps.api.apps.routes.patches import (
    ApprovalRequest,
    PreparePatchRequest,
    PatchChange,
    approve_patch,
    prepare_patch,
    preview_patch,
    reject_patch,
)
from agent_core.workspace_tools import REPO_ROOT


def test_patch_api_requires_explicit_approval_and_supports_rejection():
    relative_path = "packages/shared/agent_core/_api_patch_probe.py"
    path = REPO_ROOT / relative_path
    path.unlink(missing_ok=True)

    prepared = prepare_patch(
        PreparePatchRequest(
            changes=[
                PatchChange(
                    path=relative_path,
                    operation="create",
                    patch="full content",
                    content="value = 4\n",
                )
            ]
        )
    )
    session_id = prepared["session_id"]

    preview = preview_patch(session_id)
    assert preview["status"] == "awaiting_approval"
    assert relative_path in preview["files"]

    with pytest.raises(Exception) as exc_info:
        approve_patch(session_id, ApprovalRequest(approved=False))
    assert getattr(exc_info.value, "status_code", None) == 400
    assert not path.exists()

    applied = approve_patch(session_id, ApprovalRequest(approved=True))
    assert applied["status"] == "applied"
    assert path.read_text(encoding="utf-8") == "value = 4\n"

    rejected = reject_patch(session_id)
    assert rejected["status"] == "rejected"
    assert not path.exists()


def test_prepare_patch_rejects_unread_modified_file():
    request = PreparePatchRequest(
        changes=[
            PatchChange(
                path="packages/shared/agent_core/state.py",
                operation="modify",
                patch="@@ change",
                content="updated",
            )
        ]
    )

    with pytest.raises(Exception) as exc_info:
        prepare_patch(request)
    assert getattr(exc_info.value, "status_code", None) == 400


def test_prepare_patch_accepts_git_stash_option():
    relative_path = "packages/shared/agent_core/_api_stash_probe.py"
    path = REPO_ROOT / relative_path
    path.write_text("user version\n", encoding="utf-8")

    prepared = prepare_patch(
        PreparePatchRequest(
            use_git_stash=True,
            context_paths=[relative_path],
            changes=[
                PatchChange(
                    path=relative_path,
                    operation="modify",
                    patch="full content",
                    content="agent version\n",
                )
            ],
        )
    )

    assert prepared["use_git_stash"] is True
    reject_patch(prepared["session_id"])
    assert path.read_text(encoding="utf-8") == "user version\n"
    path.unlink(missing_ok=True)
