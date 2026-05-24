from sqlmodel import Session , text 
from ..database import engine 

def enable_pgvector():
    """
    Run once on startup to enable the pgvector extension.
    RAG phase will add the embeddings table on top of this.
    """
    with Session(engine) as session:
        session.exec(text("CREATE EXTENSION IF NOT EXISTS vector"))
        session.commit()