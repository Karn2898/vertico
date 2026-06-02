import importlib

# Try Google GenAI first, fall back to NVIDIA SDK if available
try:
    genai = importlib.import_module("google.generativeai")
except Exception:
    try:
        genai = importlib.import_module("nvidia")
    except Exception:
        genai = None
import os
import time
from typing import Optional, Callable

embedding_dim=768
model="models/embedding-001"

batch_size=50
rate_limit_delay=0.1

def init_embedder():
    api_key = os.environ.get("NVIDIA_API_KEY")
    if api_key:
        try:
            genai.configure(api_key=api_key)
        except Exception:
            # best-effort configure; ignore if library not available in this env
            pass

    
def embed_text(text:str , task_type:str="retrieval_document"):
    result=genai.embed_content(
        model=model,
        content=text ,
        task_type=task_type
    )

    return result["embedding"]

def embed_batch(
    texts: list[str],
    task_type: str = "retrieval_document",
    on_progress: Optional[Callable] = None,
):
    init_embedder()
    embeddings: list[list[float]] = []
    total = len(texts)

    for i in range(0, total, batch_size):
        batch = texts[i : i + batch_size]

        batch_embeddings = [
            embed_text(text, task_type=task_type) for text in batch
        ]

        embeddings.extend(batch_embeddings)

        if on_progress:
            on_progress(min(i + batch_size, total), total)

        if i + batch_size < total:
            time.sleep(rate_limit_delay)

    return embeddings


def embed_query(query: str):
    init_embedder()
    return embed_text(query, task_type="retrieval_query")