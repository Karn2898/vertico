import uuid
from datetime import datetime
from typing import Optional

from pgvector.sqlalchemy import Vector
from sqlalchemy import Text
from sqlmodel import Column, Field, SQLModel


class EmbeddingModel(SQLModel, table=True):
    __tablename__ = "embeddings"

    id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        primary_key=True,
    )

    repo_path: str = Field(index=True)
    file_path: str = Field(index=True)
    language: str = Field(default="python")

    chunk_type: str
    chunk_name: Optional[str] = None
    content: str = Field(sa_column=Column(Text))
    start_line: int
    end_line: int

    embedding: list[float] = Field(sa_column=Column(Vector(768)))

    indexed_at: datetime = Field(default_factory=datetime.utcnow)
