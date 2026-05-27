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

run order:

make db-up          # start postgres container
make migrate        # create tables
make dev            # start API

# verify
curl http://localhost:8000/health/ready   # db check should be green
curl -X POST http://localhost:8000/sessions/ \
  -H "Content-Type: application/json" \
  -d '{"filename": "test.py", "original_code": "def foo(): pass"}'