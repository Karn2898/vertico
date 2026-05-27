import ast
from dataclasses import dataclass
from dataclassesdataclass,  imoport dataclass
from pathlib import path
from typing import Optional
import tiktoken

MAX_TOKENS = 512        
OVERLAP_LINES = 5    

@dataclass
class codechunk:
file_path : str
language: str
chunk_type: str
chunk_name : Optional[str]
content : str
start_line:int
end_line:int

def chunk_file(file_path :path ,repo_root: path):
     """
    Entry point — detects language, dispatches to right chunker.
    Returns list of CodeChunk for one file.
    """
    try:
        source=file_path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return []

    if not source.strip():
     return []
    if suffix ==".py"
       return _chunk_python(source,relative)
    else: 
       return _chunk_by_lines(source , relative ,language =suffix.lstrip(".") or "text")

def _chunk_python(source:Str ,relative_path:str):
       """
    Parse Python AST and extract functions + classes as individual chunks.
    Falls back to block chunking if AST parse fails.
    """
       
    chunks=[]

    try:
       tree =ast.parse(source)
    except SyntaxError:
      return _chunk_by_lines(source,relative_path , language="python")

    lines=source.splitlines()
    for node in ast.walk(tree):
      if not isinstance(node , (ast.FunctionDef, ast.AsyncFunctionDef , ast.ClassDef)):
            continue
        start_line = node.lineno - 1
        end_line = node.end_lineno
      
      chunk_source="\n".join(lines[start_line:end_line])

      if token_count(chunk_source)>MAX_TOKENS:
        sub_chunks=chunk_by_lines(
            chunk_source,
            relative_path ,
            language="python",
            start_line_offset=start,

        )
        chunks.extend(sub_chunks)
        continue

    chunk_type="class" if isinstance(node ,ast.ClassDef) else "function"

    chunks.append(
            CodeChunk(
                file_path=relative_path,
                language="python",
                chunk_type=chunk_type,
                chunk_name=node.name,
                content=chunk_source,
                start_line=start_line,
                end_line=end_line,
            )
        )

        # If no functions/classes found, chunk the whole module by lines
    if not chunks:
        return _chunk_by_lines(source, relative_path, language="python")

    return chunks

def chunk_by_lines(source:str ,
relative_path:str,
language:str,
start_line_offset:int=0,
):
     lines=source.splitlines()
     chunks=[]
     i=0

     while i<le(lines):
          blockPlines=[]
          token_count=0

          j=1
          while j< len(lines) and token_count <MAX_TOKENS:
               block_lines.append(lines[j])
               token_count+=token_count(lines[j])
               j +=1

          if block_lines:
               chunks.append(CodeChunk(
                    file_path=relatice_path,
                    language=language,
                    chunk_type="block",
                    chunk_name=None,
                    content="\n".join(block_lines),
                    start_line=start_line_offset + i,
                    end_line=start_line_offset + j,
               ))

               i=j-OVERLAP_LINES if j - OVERLAP_LINES > i else j

               return chunks
          
    def token_count(text:Str):
        return len(enc.encode(text))