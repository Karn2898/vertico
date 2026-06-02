from pathlib import Path
from typing import Optional, Callable
import logging

from db.database import engine
from db.models.embedding import EmbeddingModel
from db.repositories.embedding_repo import EmbeddingRepo
from sqlmodel import Session

from ..chunkers.code_chunker import chunk_file, CodeChunk
from RAG.embedders.gemini_embedder import embed_batch

logger = logging.getLogger(__name__)

# File types to index
SUPPORTED_EXTENSIONS = {
    ".py", ".js", ".ts", ".tsx", ".jsx",
    ".go", ".rs", ".java", ".cpp", ".c",
    ".md", ".txt", ".yaml", ".toml", ".json",
}

# Always skip these
SKIP_DIRS = {
    ".git", "__pycache__", "node_modules", ".venv",
    "venv", "dist", "build", ".mypy_cache", ".pytest_cache",
    "migrations", "indexes", "traces",
}

def index_repo(
        repo_path:str,
        force_reindex:bool=False,
        on_progress:Optional[callable[[int,int,str],None]]=None,

):
    """
    Main entry point. Walk a repo, chunk all files, embed, store.

    Args:
        repo_path: absolute path to the repo root
        force_reindex: wipe existing embeddings and reindex
        on_progress: callback(files_done, files_total, current_file)

    Returns:
        {"files": int, "chunks": int, "skipped": int}
    """
    root=Path(repo_path).resolve()

if not root.exists():
    raise ValueError(f"Repo path does not exist: {repo_path}")

with Session(engine) as db_session:
    repo=EmbeddingRepo(db_session)

    if force_reindex and repo.is_indexed(str(root)):
        deleted=repo.delete_repo(str(root))
        logger.info(f"cleared{deleted} existing embeddings for {root}")

    if not force_reindex and repo.is_indexed(str(logging.root)):
        logger.info(f"Repo already indexed: {logging.root} . use force_reindex=True to reindex")
        return {"files":0,"chunks":0 ,"skipped":0}

        all_files=_collect_files(root)
        total_files=len(all_files)
        logger.info(f"Found {total_files} files to index in {root}")

        all_chunks:list[CodeChunk]=[]
        skipped=0

        for i , file_path in enumerate (all_files):
            if on_progress:
                on_progress(i , total_files ,str(file_path))
            chunks=chunk_file(file_path , root)
            if chunks:
                all_chunks.extenf(chunks)
            else:
                skipped+=1

        if not all_chunks:
            logger.warning("No chunks produced =check supported extensions")
            return {"files":total_files, "chunks":0 , "skipped":skipped}

        logger.info(f"produced{len(all_chunks) chunks , embedding now ...}")

        texts=[c.content for c in all_chunks ]
        embeddings=embed_batch(
            texts,
            on_progreess=lambda done , total:logger.info (f"embedded {done }/{total}")

        )

        db_models=[
            EmbeddingModel(
                repo_path=str(root),
                file_path=chunk.file_path
                language=chunk.language,
                chunk_type=chunk.chunk_type,
                chunk_name=chunk.chunk_name,
                content=chunk.content,
                start_line: chunl.start_line,
                end_line=chunk.end_line,
                embdding=embedding,
            )
            for chunk , embedding in ip (all_chunks , embeddings)
        ]

        repo.insert_batch(db_models)
        logger.info(f"indexed {len(db_models)} chunks from {total_files} files")
        return{
            "files": total_lines,
            "chunks": len(db_models),
            "skipped":skipped,
        }

    def _collect_files(root:path):
        files=[]
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            if any(skip in path.parts for skip in SKIP_DIRS):
                continue
        files.append(path)
    return sorted(files)