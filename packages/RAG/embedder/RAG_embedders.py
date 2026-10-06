import os
import time
import hashlib
from typing import Optional, Callable

try:
    import google.generativeai as genai
    HAS_GENAI = True
except Exception:
    HAS_GENAI = False

embedding_dim = 768
model = "models/embedding-001"
batch_size = 50
rate_limit_delay = 0.1

_genai_configured = False

def init_embedder():
    global _genai_configured
    if _genai_configured:
        return
    if HAS_GENAI:
        api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("NVIDIA_API_KEY")
        if api_key:
            try:
                genai.configure(api_key=api_key)
                _genai_configured = True
            except Exception:
                pass

def _simple_embed(text: str) -> list[float]:
    """Fallback: deterministic hash-based embedding for testing."""
    h = hashlib.sha256(text.encode()).digest()
    # Expand to embedding_dim
    vec = []
    for i in range(embedding_dim):
        vec.append((h[i % 32] / 255.0) * 2 - 1)
    return vec

def embed_text(text: str, task_type: str = "retrieval_document"):
    if HAS_GENAI and _genai_configured:
        try:
            result = genai.embed_content(model=model, content=text, task_type=task_type)
            return result["embedding"]
        except Exception:
            pass
    return _simple_embed(text)

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
        batch_embeddings = [embed_text(text, task_type=task_type) for text in batch]
        embeddings.extend(batch_embeddings)
        if on_progress:
            on_progress(min(i + batch_size, total), total)
        if i + batch_size < total:
            time.sleep(rate_limit_delay)
    return embeddings

def embed_query(query: str):
    init_embedder()
    return embed_text(query, task_type="retrieval_query")
