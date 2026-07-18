import argparse
import os
import sys
from pathlib import Path    


DEFAULT_MESSY_CODE = """def process_data_stuff(d):
    res = []
    for i in range(len(d)):
        if d[i].get('status') == 'active':
            if d[i].get('age') > 18:
                val = d[i].get('score') * 10
                res.append({'n': d[i]['name'], 'v': val})
    return res
"""


def _load_code(path: str | None) :
    if not path:
        return DEFAULT_MESSY_CODE
    return Path(path).read_text(encoding="utf-8")


def _load_env_file(repo_root: Path) -> None:
    """Load key=value pairs from .env into process environment if missing."""
    env_path = repo_root / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def _has_api_key() -> bool:
    return bool(
        os.environ.get("NVIDIA_API_KEY")
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Test the agent graph with code input.")
    parser.add_argument(
        "--code-file",
        help="Path to a Python file containing code to test. Defaults to embedded messy sample.",
    )
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent
    _load_env_file(repo_root)

    shared_path = repo_root / "packages" / "shared"
    sys.path.append(str(shared_path))

    from agent_core.state import code_linter
    import agent_core.graphs as graphs

    code = _load_code(args.code_file)
    initial_state = {
        "original_code": code,
        "review_notes": "",
        "refactored_code": code,
        "errors": None,
        "iterations": 0,
    }

    print("[1/2] Running linter node...")
    lint_result = code_linter(initial_state)
    print("Lint result:", lint_result)

    if not _has_api_key():
        print(
            "[2/2] Skipping full graph: set NVIDIA_API_KEY to run reviewer/refactorer nodes."
        )
        return 0
        return 0

    print("[2/2] Running full graph...")
    app = graphs.workflow.compile()
    try:
        result = app.invoke(initial_state)
    except Exception as exc:
        message = str(exc)
        if "503" in message and "UNAVAILABLE" in message:
            print(
                "Full graph failed: upstream generative service is temporarily overloaded (503 UNAVAILABLE)."
            )
            print("Retry in a few moments, or switch to a different model in agent_core/config.py.")
            return 1
        print(f"Full graph failed: {exc}")
        return 1

    print("Graph completed. State keys:", sorted(result.keys()))

    refactored = result.get("refactored_code")
    if refactored:
        print("Refactored code preview:\n")
        print(refactored[:500])

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
