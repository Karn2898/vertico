# vertico

AI coding assistant to be used in IDE.

Vertico is an AI coding assistant designed to integrate with IDEs and help developers with code completion, refactoring suggestions, and context-aware assistance.

## Features


- Context-aware code suggestions
- Refactoring guidance
- IDE integration hooks
- Lightweight and extensible

## Architecture

- **`packages/`** — reusable core: `shared/agent_core` (LangGraph agent graphs, tools, memory, evaluation), `RAG` (repo indexing, embedders, retrievers, rerankers), `db` (SQLModel models, repositories, pgvector), `sandbox` (Docker-based code execution).
- **`apps/api/`** — FastAPI backend (routes, schemas, services, middleware).
- **`apps/worker/`** — Celery worker running refactor / bugfix / review tasks.
- **`src/`** — VS Code extension (TypeScript) + React webview components.
- **`apps/api/apps/IDE extension/`** — the packaged VS Code extension entrypoint.

## Prerequisites

- Python 3.12 (a venv is provided at `vertico/`)
- Node.js + npm (for the extension)
- Docker (for Postgres + Redis)
- An LLM API key — the backend reads `NVIDIA_API_KEY` from `.env`

## Setup

```bash
cd /workspaces/vertico
source vertico/bin/activate

# install Python deps
pip install -r Requirements.txt
pip install -e packages/db -e packages/RAG -e packages/sandbox

# install extension deps
cd apps/api/apps/IDE\ extension && npm install && cd ../../..
```

Copy `.env` if needed and set your key:

```bash
cp .env .env.local   # or just edit .env
# NVIDIA_API_KEY=nvapi-...
```

## Run order

### 1. Start Postgres + Redis

```bash
docker compose -f infra/docker/docker-compose.yaml up -d db redis
```

This starts `vertico-db` (Postgres user `tom` / password `vertoco123` / db `vertico`)
and `vertico-redis`. Then create the tables and enable pgvector:

```bash
make migrate        # cd packages/db && alembic upgrade head
```

### 2. Start the API

The API runs from the repo root (it imports `apps.*`, `db.*`, `agent_core.*`).

```bash
cd /workspaces/vertico
source vertico/bin/activate
cd apps/api
uvicorn apps.main:app --reload --port 8000
```

Verify:

```bash
curl http://localhost:8000/health/ready
curl http://localhost:8000/        # -> { "name": "Vertico API", ... }
```

### 3. Start the Celery worker

The worker runs the refactor / bugfix / review graphs.

```bash
cd /workspaces/vertico
source vertico/bin/activate
export DATABASE_URL=postgresql://tom:vertoco123@localhost:5432/vertico
export REDIS_URL=redis://localhost:6379/0
export PYTHONPATH=/workspaces/vertico/packages/shared:$PYTHONPATH
celery -A apps.worker.celery_app worker --loglevel=info --concurrency=2 --queues=refactor,bugfix,review,default
```

(Or `make worker-dev`.)

### 4. Index a repository (optional but recommended)

Run this before agent runs so RAG context is available:

```bash
make index-repo path=/path/to/repo
# or from the VS Code command palette: "Index Repository"
```

### 5. Use it in VS Code

```bash
cd apps/api/apps/IDE\ extension
npm run build     # compiles src/ -> out/extension.js
```

Then in VS Code:

1. Open this repo as the workspace.
2. Press **F5** (Run Extension) to launch an Extension Development Host.
3. Open a Python file and run commands from the palette (Ctrl+Shift+P):
   - **Refactor File** (Ctrl+Shift+R) — enqueues the `refactor` graph
   - **Fix Bug** — prompts for an error message, enqueues `bugfix`
   - **Review File** — enqueues `review`
   - **Start Vertico** (Ctrl+Shift+V) — opens the chat panel
   - **Index Repository** — indexes the open workspace into pgvector

> **Note:** the extension's `apiUrl` defaults to `http://localhost:3000/api`
> (see `Vertico.apiUrl` in `package.json` / `extension.ts`). Your API listens on
> port `8000`, so set `Vertico.apiUrl` to `http://localhost:8000` (or update
> `extension.ts`) so the extension can reach the backend.

## Desktop app (Electron + `.deb`)

Vertico ships a self-contained desktop application (its own window, no browser
needed) built with Electron. The web UI is bundled, so the app launches even
without a backend; when the API is running it connects automatically.

### Build the `.deb`

```bash
# 1. Build the React web UI into the desktop app
cd webview-dev && npm install && npm run build && cp -r dist ../apps/desktop/web && cd ..

# 2. Build the Electron app + .deb (downloads Electron ~100MB on first run)
cd apps/desktop && npm install && npm run build:linux
```

Output: `apps/desktop/release/vertico-desktop_0.1.0_amd64.deb`
(copied to repo root as `vertico-desktop_0.1.0_amd64.deb`).

### Install & run

```bash
sudo dpkg -i vertico-desktop_0.1.0_amd64.deb
vertico-desktop          # launches its own window
```

The window loads, in priority order:
1. `http://localhost:5173` — the live web UI dev server (if running)
2. `http://localhost:8000/docs` — the API docs (if running)
3. The **bundled static web UI** — works fully offline with no backend

### How the desktop app talks to the API

The web UI (`webview-dev/src/App.tsx`) creates a session on startup and streams
chat via `POST /chat/message` (Server-Sent Events), using the shared
`src/services/ApiClient.ts`. It auto-detects the API at `http://localhost:8000`
and shows an "offline" badge if it is not running. To use a different API URL,
pass it as a query param: `file://.../index.html?api=http://host:port`.

### Files

- `apps/desktop/` — Electron main process (`main.js`), preload (`preload.js`),
  `package.json` (electron-builder config), and `web/` (bundled UI).
- `webview-dev/` — Vite React app that becomes the UI (`npm run dev` for live reload).
- `packaging/vertico/` — lightweight Python/tkinter `.deb` alternative that just
  opens the web UI in your browser (see "Legacy `.deb` (launcher)" below).

### Legacy `.deb` (launcher)

A dependency-light `.deb` that only opens the web UI in your default browser:
build with `dpkg-deb --build packaging/vertico vertico_0.1.0_amd64.deb` (see
`packaging/vertico/DEBIAN/control` for metadata). Install with
`sudo dpkg -i vertico_0.1.0_amd64.deb`, then run `vertico`.

## Known gaps

- `infra/docker/api.Dockerfile` does not exist yet (only `worker.Dockerfle`),
  so `docker compose up` will not start the API container — run it with
  `uvicorn` as shown in step 2.
- The compose `db` service uses Postgres user `tom`, while `.env` /
  `packages/db/migrations/env.py` reference `vertico`. Use the `tom` credentials
  for the worker, and align `.env` if you run the API via compose.
- The API does not mount its routers by default — `apps/api/apps/main.py`
  includes them from `apps/api/apps/routes`. The `packages/db` package must be
  installed (`pip install -e packages/db`) or the in-memory session store is used.
- `packages/db/pyproject.toml` has a duplicated `[tool.poetry]` block that breaks
  `pip install -e packages/db`; consolidate it before installing the DB package.

## Contributing

Contributions are welcome. Open issues or submit pull requests. Follow repository
coding conventions and include tests where appropriate.

## License

See the LICENSE file for license details.
