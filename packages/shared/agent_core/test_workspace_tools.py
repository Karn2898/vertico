import json

import pytest

from agent_core.workspace_tools import read_code_file, search_code


def test_search_code_returns_bounded_structured_matches():
    matches = json.loads(
        search_code.invoke(
            {
                "query": "class RefactorState",
                "path": "packages/shared/agent_core",
                "max_results": 1,
            }
        )
    )

    assert len(matches) == 1
    assert matches[0]["path"].endswith("state.py")
    assert matches[0]["line"] > 0


def test_read_code_file_returns_requested_range():
    result = json.loads(
        read_code_file.invoke(
            {
                "path": "packages/shared/agent_core/state.py",
                "start_line": 1,
                "end_line": 3,
            }
        )
    )

    assert result["path"] == "packages/shared/agent_core/state.py"
    assert result["start_line"] == 1
    assert result["end_line"] == 3
    assert "import ast" in result["content"]


@pytest.mark.parametrize("path", ["../.env", ".env", "packages/../.env"])
def test_workspace_tools_reject_secret_or_escape_paths(path):
    with pytest.raises(ValueError):
        read_code_file.invoke({"path": path})
