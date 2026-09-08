import json
from pathlib import Path

import pytest

from agent_core.workspace_tools import (
    read_code_file,
    reset_active_repo_root,
    search_code,
    set_active_repo_root,
)


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


def test_workspace_tools_use_active_development_host_root(tmp_path: Path):
    target = tmp_path / "remote_module.py"
    target.write_text("class RemoteModule:\n    pass\n", encoding="utf-8")
    token = set_active_repo_root(tmp_path)
    try:
        matches = json.loads(search_code.invoke({"query": "RemoteModule"}))
        result = json.loads(read_code_file.invoke({"path": "remote_module.py"}))
    finally:
        reset_active_repo_root(token)

    assert matches[0]["path"] == "remote_module.py"
    assert "class RemoteModule" in result["content"]
