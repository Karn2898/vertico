import json

import pytest

from agent_core.planning import build_patch_plan, plan_file_changes


CONTEXT_PATHS = {"packages/shared/agent_core/state.py"}


def test_build_patch_plan_normalizes_multi_file_changes():
    plan = build_patch_plan(
        [
            {
                "path": "packages/shared/agent_core/state.py",
                "operation": "modify",
                "patch": "@@ change state",
                "reason": "store the plan for later application",
            },
            {
                "path": "packages/shared/agent_core/new_module.py",
                "operation": "create",
                "patch": "content",
                "reason": "add a focused helper",
            },
        ],
        CONTEXT_PATHS,
    )

    assert plan["status"] == "proposed"
    assert [change["path"] for change in plan["changes"]] == [
        "packages/shared/agent_core/state.py",
        "packages/shared/agent_core/new_module.py",
    ]


def test_modify_requires_read_context():
    with pytest.raises(ValueError, match="must be read"):
        build_patch_plan(
            [
                {
                    "path": "packages/shared/agent_core/graphs.py",
                    "operation": "modify",
                    "patch": "@@ change graph",
                }
            ]
        )


def test_plan_can_request_more_context_without_changes():
    plan = build_patch_plan([], needs_more_context=True)

    assert plan == {
        "changes": [],
        "needs_more_context": True,
        "status": "needs_context",
    }


def test_plan_tool_returns_json_and_rejects_escape():
    result = json.loads(
        plan_file_changes.invoke(
            {
                "changes_json": json.dumps(
                    [
                        {
                            "path": "packages/shared/agent_core/state.py",
                            "operation": "modify",
                            "patch": "@@ change state",
                        }
                    ]
                ),
                "context_paths_json": json.dumps(list(CONTEXT_PATHS)),
            }
        )
    )
    assert result["status"] == "proposed"

    with pytest.raises(ValueError):
        build_patch_plan(
            [{"path": "../outside.py", "operation": "create", "patch": "x"}]
        )
