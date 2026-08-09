

FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY packages/ packages/
COPY apps/worker/ apps/worker/

RUN pip install -e packages/db
RUN pip install -e packages/rag
RUN pip install -e packages/agent-core
RUN pip install celery redis sqlmodel psycopg2-binary

CMD ["celery", "-A", "apps.worker.celery_app", "worker", "--loglevel=info", "--concurrency=4"]