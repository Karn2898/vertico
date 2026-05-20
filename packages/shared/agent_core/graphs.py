def decide_to_finish(state: RefactorState):
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

# Conditional Logic
workflow.add_conditional_edges(
    "linter",
    decide_to_finish,
    {
        "rewrite": "refactorer", # Loop back
        "end": END              # Exit
    }
)
