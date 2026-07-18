from langgraph.graph import END, StateGraph

from .state import (
    RefactorState,
    BugfixState,
    code_linter,
    code_refactorer,
    code_review,
    code_fixer,
)


def decide_to_finish(state):
    """Router to decide if we loop back or end."""
    if state.get("errors") is None or state.get("iterations", 0) > 3:
        return "end"
    return "rewrite"


workflow = StateGraph(RefactorState)
workflow.add_node("reviewer", code_review)
workflow.add_node("refactorer", code_refactorer)
workflow.add_node("linter", code_linter)
workflow.set_entry_point("reviewer")
workflow.add_edge("reviewer", "refactorer")
workflow.add_edge("refactorer", "linter")
workflow.add_conditional_edges(
    "linter",
    decide_to_finish,
    {
        "rewrite": "refactorer",
        "end": END,
    },
)


# Bugfix graph: same review -> fix -> lint loop, but seeded with an error message.
bugfix_graph = StateGraph(BugfixState)
bugfix_graph.add_node("reviewer", code_review)
bugfix_graph.add_node("fixer", code_fixer)
bugfix_graph.add_node("linter", code_linter)
bugfix_graph.set_entry_point("reviewer")
bugfix_graph.add_edge("reviewer", "fixer")
bugfix_graph.add_edge("fixer", "linter")
bugfix_graph.add_conditional_edges(
    "linter",
    decide_to_finish,
    {
        "rewrite": "fixer",
        "end": END,
    },
)


# Review graph: review only, no rewrite loop.
review_graph = StateGraph(RefactorState)
review_graph.add_node("reviewer", code_review)
review_graph.set_entry_point("reviewer")
review_graph.add_edge("reviewer", END)
