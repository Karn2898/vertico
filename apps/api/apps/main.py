from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import time
import logging
import os

from .routes import health, sessions, chat, diffs

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",

)
logger=logging.getLogger("copilot-api")

#lifespan
has_key=bool(
    os.environ.get("NVIDIA_API_KEY")
)

if nothas_key:
    logger.warning("no api key found")
try:
    from agent_core import graphs
    graphs.workflow.compile()
    logger.info("agent graph compiled OK")
except Exception as e:
    logger.error(f"Agent graph failed to compile:{e}")

yield

logger.info("shutting down")

#close db connections here later

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
async def log_requests(request: Request , call_next):
    """Log every request with method, path, and response time."""
    start=time.time()
    response=await call_next(request)
    duration = rounf((time.time()-start)*1000,2)

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


app.include_router(health.router)
app.include_router(sessions.router)
app.include_router(chat.router)
app.include_router(diffs.router)

@app.get("/")
def root():
    return {
        "name": "Vertico API",
        "version": "0.1.0",
        "docs": "/docs",
        "health":"/health",
    }