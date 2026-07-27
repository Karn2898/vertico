from typing import Optional
from sqlmodel import Session

from db.database import engine
from db.repositories.embedding_repo import EmbeddingRepo
try:
    from ..embedders.nvidia_embedder import embed_query
except Exception:
    embed_query = None
from ..rankers.reranker import rerank

def retrieve(
    query: str ,
    repo_path : Optional[str]=None,
    top_l:int=10,
    language: Optional[str]=None,
    rerank_top_k:int=5,

):

  """
    Full retrieval pipeline:
    1. Embed the query
    2. pgvector similarity search
    3. Rerank results
    4. Return top chunks with metadata
   """
query_vector=embed_query(query)

with Session(engine) as db_session:
    repo=EmbeddingRepo(db_session)

    raw_results=repo.similarity_search(
       query_embedding=query_vector,
       repo_path=repo_path,
       top_k=top_k,
       language=language,

    )
if not raw_reults:
    return[]

reranked=rerank(query ,raw_results , top_k =rerank_top_k)
return reranked