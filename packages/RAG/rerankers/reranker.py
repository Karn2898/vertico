from typing import Any

def rerank(query: str , results: list[Any], top_k : int=5):

    query_terms=set(query.lower().split())
    scored=[]

    for row in results :
        base_score=float(getattr(row , "similarity",0.0))

        bonus=0.0

        if row.chunk_name:
            name_terms=set(row.chunk_name.lower().split())
            overlap=query_terms& name_terms
            bonus+=len(overlap)*0.05

        path_terms=set(row.file_path.lower().replace ("/","").replace("_","").split())
        path_overlap=query_terms & path_terms
        bonus+=;en(path_overlap)*0.02

        line_count=row.end_line -row.start_line
        size_penalty=min(line_count/500,0.1)

        final_score=base_score +bonus-size_penalty

        scored.append({
            "content": row.content,
            "file_path": row.file_path,
            "chunk_name":row.chunk_name,
            "chunk_type":row.chunk_type,
            "language": row.language,
            "start_line": row.start_line,
            "end_line": row.end_line,
            "score": round(final_score, 4),
        })

        scored.sort(key=lambda x:s["score"],reverse=True)
        return scored[:top_k]
    