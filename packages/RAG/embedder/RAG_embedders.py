import importlib

from openai import OpenAI
import os
import sys

_USE_COLOR = sys.stdout.isatty() and os.getenv("NO_COLOR") is None
_REASONING_COLOR = "\033[90m" if _USE_COLOR else ""
_RESET_COLOR = "\033[0m" if _USE_COLOR else ""

client = OpenAI(
  base_url = "https://integrate.api.nvidia.com/v1",
  api_key = os.getenv("NVIDIA_API_KEY")
)


completion = client.chat.completions.create(
  model="z-ai/glm-5.2",
  messages=[{"role":"user","content":""}],
  temperature=1,
  top_p=1,
  max_tokens=16384,
  seed=42,
  
  stream=True
)

for chunk in completion:
  if not getattr(chunk, "choices", None):
    continue
  if len(chunk.choices) == 0 or getattr(chunk.choices[0], "delta", None) is None:
    continue
  delta = chunk.choices[0].delta
  if getattr(delta, "content", None) is not None:
    print(delta.content, end="")
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