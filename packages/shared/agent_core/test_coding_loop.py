from agent_core.graphs import decide_to_finish
from agent_core.state import code_linter


def test_code_linter_reports_errors_by_file():
    result = code_linter(
        {
            "original_code": "",
            "review_notes": "",
            "refactored_code": "",
            "errors": None,
            "iterations": 0,
            "candidate_files": {
                "good.py": "value = 1",
                "broken.py": "value =",
            },
        }
    )

    assert result["iterations"] == 1
    assert result["validation_errors"].keys() == {"broken.py"}
    assert result["errors"]


def test_code_linter_accepts_valid_multi_file_candidate():
    result = code_linter(
        {
            "original_code": "",
            "review_notes": "",
            "refactored_code": "",
            "errors": None,
            "iterations": 0,
            "candidate_files": {
                "one.py": "value = 1",
                "two.py": "value = 2",
            },
        }
    )

    assert result["validation_errors"] == {}
    assert result["errors"] is None


def test_decide_to_finish_respects_iteration_budget():
    state = {
        "errors": "syntax error",
        "validation_errors": {"broken.py": "syntax error"},
        "iterations": 2,
        "max_iterations": 3,
    }

    assert decide_to_finish(state) == "rewrite"
    assert decide_to_finish({**state, "iterations": 3}) == "end"


def test_decide_to_finish_ends_when_all_files_are_valid():
    assert decide_to_finish(
        {
            "errors": None,
            "validation_errors": {},
            "iterations": 1,
            "max_iterations": 3,
        }
    ) == "end"
