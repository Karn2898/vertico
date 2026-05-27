
from sqlmodel import Session, select, text
from pgvector.sqlalchemy import Vector
from ..models.embedding import EmbeddingModel
from typing import Optional


class EmbeddingRepo:
    def __init__(self, session:Session):
        self.session=session

    def insert_batch(self, embeddings :list[EmbeddingModel]):
        for emb in embeddings:
            self.session.add(emb)
        self.session.commit()

    def delete_repo(self, repo_path:str):
        statement=select(EmbeddingModel).where(
            EmbeddingModel.repo_path==repo_path
        )
        rows=self.session.exec(statement).all()
        for row in rows:
            self.session.delete(row)
        self.session.commit()
        return len(rows)
    
    def similarity_search(
            self,
            query_embedding: list[float],
            repo_path: Optional[str] = None,
            top_k: int = 10,
            language: Optional[str] = None,
    ):
        """
        Cosine similarity search via pgvector.
        Optionally filter by repo and language.
        """
        filters = []
        if repo_path:
            filters.append(f"repo_path='{repo_path}'")
        if language:
            filters.append(f"language='{language}'")
        where_clause = f"where {' AND '.join(filters)}" if filters else ""

        # pgvector cosine distance operator
        raw_sql = text(f"""
            SELECT *, 1 - (embedding <=> :query_vec) AS similarity
            FROM embeddings
            {where_clause}
            ORDER BY embedding <=> :query_vec
            LIMIT :top_k
        """)

        result = self.session.exec(
            raw_sql,
            params={
                "query_vec": str(query_embedding),
                "top_k": top_k,
            }
        )
        return result.all()

    def is_indexed(self,repo_path :str):
        statement=select(EmbeddingModel).where(
            EmbeddingModel.repo_path==repo_path
        ).limit(1)
        return self..session.exec(statement).first() is not None
