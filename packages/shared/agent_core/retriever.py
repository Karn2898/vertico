from rag.retrievers.vector_retriever import retrieve
from ..state.agent_state import AgentState

def retriever_node(state: AgentState):
    """
        Retrieves relevant code chunks for the current task.
        Injected into coding_graph, bugfix_graph etc.
        """

    query=state.get("task")
    repo_path=state.get("repo_path")

    if not query:
        return {"context ":[]}
    results=retrieve(
        query=query,
        repo_path=repo_path,
        top_k=10,
        rerank_top_k=5,
    )

    context_blocks=[
        f"# {r['file_path']} — {r['chunk_name'] or r['chunk_type']} "
        f"(lines {r['start_line']}-{r['end_line']})\n{r['content']}"
        for r in results
    ]

    return {"context": context_blocks}