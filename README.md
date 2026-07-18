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

## Known gaps

- `infra/docker/api.Dockerfile` does not exist yet (only `worker.Dockerfle`),
  so `docker compose up` will not start the API container — run it with
  `uvicorn` as shown in step 2.
- The compose `db` service uses Postgres user `tom`, while `.env` /
  `packages/db/migrations/env.py` reference `vertico`. Use the `tom` credentials
  for the worker, and align `.env` if you run the API via compose.
- `apps/routes/health.py` has a pre-existing syntax error (`str{e}`) that breaks
  that module's import; fix it before relying on the health route.

## Contributing

Contributions are welcome. Open issues or submit pull requests. Follow repository
coding conventions and include tests where appropriate.

## License

See the LICENSE file for license details.
