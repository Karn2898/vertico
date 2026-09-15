import sys
from pathlib import Path

root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root / "packages" / "shared"))
sys.path.insert(0, str(root / "apps" / "api"))

import py_compile
py_compile.compile(str(root / "apps" / "api" / "apps" / "routes" / "chat.py"), doraise=True)
print("syntax OK")

import apps.routes.chat as chat
print("module OK, routes:", [r.path for r in chat.router.routes])
