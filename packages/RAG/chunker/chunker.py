import ast
import importlib
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, List

def _init_encoder():
    try:
        spec = importlib.util.find_spec("tiktoken")
        if spec is None:
            return None
        tiktoken = importlib.import_module("tiktoken")
        try:
            return tiktoken.get_encoding("cl100k_base")
        except Exception:
            return None
    except Exception:
        return None


enc = _init_encoder()


def token_count(text: str) -> int:
    if enc is not None:
        return len(enc.encode(text))
    # fallback: approximate by words
    return max(1, len(text.split()))

MAX_TOKENS = 512
OVERLAP_LINES = 5


@dataclass
class CodeChunk:
    file_path: str
    language: str
    chunk_type: str
    chunk_name: Optional[str]
    content: str
    start_line: int
    end_line: int


def chunk_file(file_path: Path, repo_root: Path) -> List[CodeChunk]:
    """Entry point — detect language and dispatch to the right chunker.

    Returns list of CodeChunk for one file.
    """
    try:
        source = file_path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return []

    if not source.strip():
        return []

    relative = str(file_path.relative_to(repo_root)) if repo_root in file_path.parents or file_path == repo_root else str(file_path)
    suffix = file_path.suffix.lower()

    if suffix == ".py":
        return _chunk_python(source, relative)
    else:
        return chunk_by_lines(source, relative, language=(suffix.lstrip('.') or "text"))


def _chunk_python(source: str, relative_path: str) -> List[CodeChunk]:
    """Parse Python AST and extract functions + classes as individual chunks.

    Falls back to block chunking if AST parse fails.
    """
    chunks: List[CodeChunk] = []

    try:
        tree = ast.parse(source)
    except SyntaxError:
        return chunk_by_lines(source, relative_path, language="python")

    lines = source.splitlines()

    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            continue

        start_line = getattr(node, "lineno", 1) - 1
        end_line = getattr(node, "end_lineno", start_line + 1)

        chunk_source = "\n".join(lines[start_line:end_line])

        if token_count(chunk_source) > MAX_TOKENS:
            sub_chunks = chunk_by_lines(
                chunk_source,
                relative_path,
                language="python",
                start_line_offset=start_line,
            )
            chunks.extend(sub_chunks)
            continue

        chunk_type = "class" if isinstance(node, ast.ClassDef) else "function"

        chunks.append(
            CodeChunk(
                file_path=relative_path,
                language="python",
                chunk_type=chunk_type,
                chunk_name=getattr(node, "name", None),
                content=chunk_source,
                start_line=start_line,
                end_line=end_line,
            )
        )

    # If no functions/classes found, chunk the whole module by lines
    if not chunks:
        return chunk_by_lines(source, relative_path, language="python")

    return chunks


def chunk_by_lines(
    source: str,
    relative_path: str,
    language: str,
    start_line_offset: int = 0,
) -> List[CodeChunk]:
    lines = source.splitlines()
    chunks: List[CodeChunk] = []
    i = 0
    # use module-level token_count

    while i < len(lines):
        block_lines: List[str] = []
        tokens = 0

        j = i
        while j < len(lines) and tokens < MAX_TOKENS:
            block_lines.append(lines[j])
            tokens += token_count(lines[j])
            j += 1

        if block_lines:
            chunks.append(
                CodeChunk(
                    file_path=relative_path,
                    language=language,
                    chunk_type="block",
                    chunk_name=None,
                    content="\n".join(block_lines),
                    start_line=start_line_offset + i,
                    end_line=start_line_offset + j,
                )
            )

        # advance with overlap
        next_i = j - OVERLAP_LINES if (j - OVERLAP_LINES) > i else j
        i = next_i

    return chunks