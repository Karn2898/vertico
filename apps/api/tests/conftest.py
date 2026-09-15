import sys
from pathlib import Path

# Ensure the api root (parent of tests/) is importable so `apps.*` and
# `agent_core` resolve regardless of where pytest is invoked from.
_API_ROOT = Path(__file__).resolve().parents[1]
for _p in (str(_API_ROOT), str(_API_ROOT.parents[1] / "packages" / "shared")):
    if _p not in sys.path:
        sys.path.insert(0, _p)
