from contextlib import asynccontextmanager
import logging
import os
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("copilot-api")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up...")

    has_key = bool(os.environ.get("NVIDIA_API_KEY"))

    if not has_key:
        logger.warning("no api key found")
    try:
        from agent_core import graphs
        graphs.workflow.compile()
        logger.info("agent graph compiled OK")
    except Exception as e:
        logger.error(f"Agent graph failed to compile:{e}")

    try:
        from db.database import create_db_and_tables
        create_db_and_tables()
        logger.info("DB tables created")

        from db.vector.pgvector import enable_pgvector
        enable_pgvector()
        logger.info("pgvector enabled ok")
    except ModuleNotFoundError:
        logger.warning("db package not importable; skipping DB init")

    yield

    logger.info("Shutting down...")

app=FastAPI(
    title="vertico api",
    description="backend for the coding refactor agent",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,# swap with specific origins in prod
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log every request with method, path, and response time."""
    start = time.time()
    response=await call_next(request)
    duration = round((time.time() - start) * 1000, 2)

    logger.info(
        f"{request.method} {request.url.path} "
        f"{response.status_code}({duration}ms)"
    )
    return response

@app.middleware("http")
async def catch_unhandled_errors(request:Request , call_next):
    """
    Global error catcher.
    Returns clean JSON instead of raw 500 HTML for unhandled exceptions.
    """
    try:
        return await call_next(request)
    except Exception as e:
        logger.exception("Unhandled error: %s", str(e))
        return JSONResponse(
            status_code=500,
            content={"error": "Internal Server Error",
                      "details": str(e),
                      "path":str(request.url.path)
                    },
        )




@app.get("/")
def root():
    return {
        "name": "Vertico API",
        "version": "0.1.0",
        "docs": "/docs",
        "health":"/health",
    }

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/health/ready")
def readiness():
    return {"status": "ready"}