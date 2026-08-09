#!/usr/bin/env bash
# Fixes for the vertico repo bugs found on 2026-08-09.
# Run this from the repo root (where `makefile` and `.git` live).
set -euo pipefail

if [ ! -d .git ]; then
  echo "Run this from the root of your vertico clone (no .git found here)." >&2
  exit 1
fi

echo "1/8: rewriting .gitignore (was a shell heredoc, not a gitignore file)"
cat > .gitignore << 'GITIGNORE_EOF'
# Secrets / env
.env
.env.local

# Python
__pycache__/
*.pyc
.venv/
vertico/
vertico-*/
*.egg-info/

# Node
node_modules/
webview-dev/node_modules/

# Build output
apps/api/apps/ide-extension/out/

# Editor / tooling
.vscode/
.kilo/
.idea/

# Packaging artifacts
*.vsix
dist/
build/
GITIGNORE_EOF

echo "2/8: untracking venv/ and __pycache__/ (were committed because gitignore never worked)"
git rm -r --cached vertico >/dev/null 2>&1 || true
git rm -r --cached --ignore-unmatch '*__pycache__*' >/dev/null 2>&1 || true

echo "3/8: renaming misspelled infra/docker/worker.Dockerfle -> worker.Dockerfile"
if [ -f infra/docker/worker.Dockerfle ]; then
  git mv infra/docker/worker.Dockerfle infra/docker/worker.Dockerfile
fi

echo "4/8: renaming 'apps/api/apps/IDE extension' -> 'apps/api/apps/ide-extension' (space in path breaks unquoted tooling)"
if [ -d "apps/api/apps/IDE extension" ]; then
  git mv "apps/api/apps/IDE extension" "apps/api/apps/ide-extension"
fi
echo "   untracking its node_modules/ (also committed due to the gitignore bug)"
git rm -r --cached --ignore-unmatch "apps/api/apps/ide-extension/node_modules" >/dev/null 2>&1 || true

echo "5/8: fixing makefile (docker-compose.yml -> .yaml everywhere; db-shell target used stale copilot-db/copilot/copilot names)"
cat > makefile << 'MAKEFILE_EOF'
# Makefile

db-up:
	docker compose -f infra/docker/docker-compose.yaml up db -d

db-down:
	docker compose -f infra/docker/docker-compose.yaml down

migrate:
	cd packages/db && alembic upgrade head

migrate-new:
	cd packages/db && alembic revision --autogenerate -m "$(name)"

db-shell:
	docker exec -it vertico-db psql -U tom -d vertico

# run order:
#
# make db-up          # start postgres container
# make migrate        # create tables
# make dev            # start API
#
# verify
# curl http://localhost:8000/health/ready   # db check should be green
# curl -X POST http://localhost:8000/sessions/ \
#   -H "Content-Type: application/json" \
#   -d '{"filename": "test.py", "original_code": "def foo(): pass"}'

index-repo:
	curl -X POST "http://localhost:8000/agent/index?repo_path=$(path)"

index-force:
	curl -X POST "http://localhost:8000/agent/index?repo_path=$(path)&force=true"



worker-up:
	docker compose -f infra/docker/docker-compose.yaml up redis worker -d

worker-down:
	docker compose -f infra/docker/docker-compose.yaml down worker redis

worker-logs:
	docker compose -f infra/docker/docker-compose.yaml logs -f worker

worker-dev:
	# Run worker locally without Docker (dev only)
	celery -A apps.worker.celery_app worker \
		--loglevel=info \
		--concurrency=2 \
		--queues=refactor,bugfix,review,default

flower:
	# Celery monitoring dashboard at http://localhost:5555
	celery -A apps.worker.celery_app flower --port=5555

# Sandbox commands

sandbox-build:
	docker build -f packages/sandbox/docker/base.Dockerfile \
		-t copilot-sandbox-base:latest .
	docker build -f packages/sandbox/docker/python.Dockerfile \
		-t copilot-sandbox-python:latest .
	docker build -f packages/sandbox/docker/node.Dockerfile \
		-t copilot-sandbox-node:latest .

sandbox-test-python:
	docker run --rm \
		-e SANDBOX_CODE="print('hello from sandbox')" \
		-e SANDBOX_LANG="python" \
		--network none \
		--memory 128m \
		--read-only \
		copilot-sandbox-python:latest

sandbox-test-node:
	docker run --rm \
		-e SANDBOX_CODE="console.log('hello from node sandbox')" \
		-e SANDBOX_LANG="node" \
		--network none \
		--memory 128m \
		--read-only \
		copilot-sandbox-node:latest

sandbox-clean:
	docker rmi copilot-sandbox-python:latest \
		copilot-sandbox-node:latest \
		copilot-sandbox-base:latest 2>/dev/null || true

# IDE Extension

EXTENSION_DIR := apps/api/apps/ide-extension

ext-install:
	cd $(EXTENSION_DIR) && npm install

ext-build:
	cd $(EXTENSION_DIR) && npm run build

ext-dev:
	cd $(EXTENSION_DIR) && npm run dev

ext-package:
	cd $(EXTENSION_DIR) && npx vsce package

# JetBrains
jb-build:
	cd $(EXTENSION_DIR)/jetbrains && ./gradlew buildPlugin

jb-run:
	cd $(EXTENSION_DIR)/jetbrains && ./gradlew runIde
MAKEFILE_EOF

echo "6/8: fixing packages/db/pyproject.toml (duplicated [tool.poetry] block broke pip install -e)"
cat > packages/db/pyproject.toml << 'PYPROJECT_EOF'
[tool.poetry]
name = "vertico-db"
version = "0.1.0"

[tool.poetry.dependencies]
python = "^3.11"
sqlmodel = "*"
psycopg2-binary = "*"
alembic = "*"
pgvector = "*"
PYPROJECT_EOF

echo "7/8: docker-compose.yaml worker service now also gets NVIDIA_API_KEY (config.py defaults to that provider; only GEMINI_API_KEY was wired through before)"
cat > infra/docker/docker-compose.yaml << 'COMPOSE_EOF'
services:
  db:
    image: pgvector/pgvector:pg16
    container_name: vertico-db
    environment:
      POSTGRES_DB: vertico
      POSTGRES_USER: tom
      POSTGRES_PASSWORD: vertoco123
    ports:
      - "5432:5432"
    volumes:
      - vertico_db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U tom"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build:
      context: ../../
      dockerfile: infra/docker/api.Dockerfile
    container_name: vertico-api
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://tom:vertoco123@db:5432/vertico
      NVIDIA_API_KEY: ${NVIDIA_API_KEY}
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ../../:/app       

  redis:
    image: redis:7-alpine
    container_name: vertico-redis
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  worker:
    build:
      context: ../../
      dockerfile: infra/docker/worker.Dockerfile
    container_name: vertico-worker
    environment:
      DATABASE_URL: postgresql://tom:vertoco123@db:5432/vertico
      REDIS_URL: redis://redis:6379/0
      NVIDIA_API_KEY: ${NVIDIA_API_KEY}
      GEMINI_API_KEY: ${GEMINI_API_KEY}
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ../../:/app

volumes:
  vertico_db_data:
COMPOSE_EOF

echo "8/8: rewriting .github/workflows/ci.yml (was invalid YAML, wrong package paths)"
mkdir -p .github/workflows
cat > .github/workflows/ci.yml << 'CI_EOF'
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install dependencies
        run: |
          pip install pytest pytest-asyncio pytest-mock
          pip install -e packages/db
          pip install -e packages/RAG
          pip install -e packages/sandbox
          pip install -e apps/api

      # TODO: no tests/ directory exists yet in this repo — add one before
      # relying on this step; it currently has nothing to run.
      - name: Run tests
        run: pytest tests/unit/ -v --tb=short

      - name: Lint
        run: |
          pip install ruff
          ruff check packages/ apps/

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop'
    steps:
      - uses: actions/checkout@v4

      - name: Log in to ghcr.io
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GHCR_TOKEN }}

      # TODO: infra/docker/api.Dockerfile does not exist yet (see README
      # "Known gaps"). This step will fail the build until it's added.
      - name: Build and push API image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: infra/docker/api.Dockerfile
          push: true
          tags: |
            ghcr.io/${{ github.repository_owner }}/vertico/api:${{ github.sha }}
            ghcr.io/${{ github.repository_owner }}/vertico/api:latest

      - name: Build and push worker image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: infra/docker/worker.Dockerfile
          push: true
          tags: |
            ghcr.io/${{ github.repository_owner }}/vertico/worker:${{ github.sha }}
            ghcr.io/${{ github.repository_owner }}/vertico/worker:latest

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      # TODO: infra/deploy/docker-compose.prod.yml does not exist yet in
      # this repo — add it before this job can succeed.
      - name: Deploy to Oracle VM
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.PROD_HOST }}
          username: ubuntu
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            cd /opt/vertico
            echo ${{ secrets.GHCR_TOKEN }} | docker login ghcr.io -u ${{ github.actor }} --password-stdin
            docker compose -f infra/deploy/docker-compose.prod.yml pull
            docker compose -f infra/deploy/docker-compose.prod.yml up -d --remove-orphans
            docker system prune -f
CI_EOF

# fix the internal 'main' field left over from the extension dir rename
sed -i 's|"main": "./out/apps/api/apps/IDE extension/extension.js"|"main": "./out/apps/api/apps/ide-extension/extension.js"|' \
  "apps/api/apps/ide-extension/package.json" 2>/dev/null || true

# fix stale space-path references in tsconfig.json / webview-dev/tsconfig.json / README.md
sed -i 's|apps/api/apps/IDE\\ extension|apps/api/apps/ide-extension|g; s|apps/api/apps/IDE extension|apps/api/apps/ide-extension|g' \
  tsconfig.json webview-dev/tsconfig.json README.md 2>/dev/null || true

echo
echo "Done. Review with: git status && git diff --stat"
echo "Then: git add -A && git commit -m 'Fix build/CI bugs'"
