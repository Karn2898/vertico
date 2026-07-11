# Makefile

db-up:
	docker compose -f infra/docker/docker-compose.yml up db -d

db-down:
	docker compose -f infra/docker/docker-compose.yml down

migrate:
	cd packages/db && alembic upgrade head

migrate-new:
	cd packages/db && alembic revision --autogenerate -m "$(name)"

db-shell:
	docker exec -it copilot-db psql -U copilot -d copilot

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
	docker compose -f infra/docker/docker-compose.yml up redis worker -d

worker-down:
	docker compose -f infra/docker/docker-compose.yml down worker redis

worker-logs:
	docker compose -f infra/docker/docker-compose.yml logs -f worker

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

ext-install:
	cd apps/ide-extension && npm install
	cd apps/ide-extension/webview && npm install

ext-build:
	cd apps/ide-extension/webview && npm run build
	cd apps/ide-extension && npm run build

ext-dev:
	cd apps/ide-extension/webview && npm run dev &
	cd apps/ide-extension && npm run dev

ext-package:
	cd apps/ide-extension && npx vsce package

# JetBrains
jb-build:
	cd apps/ide-extension/jetbrains && ./gradlew buildPlugin

jb-run:
	cd apps/ide-extension/jetbrains && ./gradlew runIde