from celery import Task
from celery.utils.log import get_task_logger

from .celery_app import app
from .task_handlers import handle_refactor, handle_bugfix, handle_review
from db.repositories.session_repo import SessionRepo
from db.database import engine
from sqlmodel import Session

logger = get_task_logger(__name__)


class GraphTask(Task):
    abstract=True

    def on_failure(self , exc , task_id , args ,kwargs ,einfo):
        """Mark session as failed in DB if task crashes."""
        session_id =args[0] if args else kwargs.get("session_id")

        if session_id :
            with Session(engine) as db:
                repo=SessionRepo(db)
                repo.update_status(session_id , "failed")

            logger.error(f"task {task_id} failed for session {session_id} with error: {exc}")
        def on_retry(self , exc , task_id , args , kwargs , einfo):
            session_id=args[0] if args else kwargs.get("session_id")
            logger.warning(f"task {task_id} for session {session_id} is being retried due to error: {exc}")


    @app.task(
        bind=True,
        base=GraphTask,
        name="apps.worker.runner.run_refactor",
        max_retires=2,
        default_retry_delay=10,
    )

    def run_refactor(self , session_id: str):
        try:
            return handle_refactor(session_id)
        except Exception as e:
            if _is_transient(exc):
                raise self.retry(exc=exc)
            raise

    @app.task(
    bind=True,
    base=GraphTask,
    name="apps.worker.runner.run_bugfix",
    max_retries=2,
    default_retry_delay=10,
)
    def run_bugfix(self , session_id: str , error_message: str =""):
        try:
            return handle_bugfix(session_id : str , error_message
        except Exception as e:
        if _is_transient(exc):
            raise self.retry(exc=exc)
        raise

@app.task(
    bind=True,
    base=GraphTask,
    name="apps.worker.runner.run_review",
    max_retries=2,
    default_retry_delay=10,
)
def run_review(self, session_id: str) -> dict:
    try:
        return handle_review(session_id)
    except Exception as exc:
        if _is_transient(exc):
            raise self.retry(exc=exc)
        raise             


def _is_transient(exc: Exception) -> bool:
    """Retry on network/API errors, not on logic errors."""
    # Placeholder logic for transient error detection
    transient_errors = (ConnectionError, TimeoutError)
    return isinstance(exc, transient_errors)