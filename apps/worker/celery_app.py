from celery import Celery
from celery.utils.log import get_task_logger
import os
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

app = Celery(
    "vertico-worker",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=[
        "apps.worker.runner",
    ],
)

app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    task_soft_time_limit=200,
    task_time_limit=600,
    result_expires=3600,
    task_routes={
        "apps.worker.runner.run_refactor": {"queue": "refactor"},
        "apps.worker.runner.run_bugfix": {"queue": "bugfix"},
        "apps.worker.runner.run_review": {"queue": "review"},
    },
    task_default_queue="default",
)

logger = get_task_logger(__name__)
