from langgraph.graph import END, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition

from .tools import llm_with_tools, tools


workflow = StateGraph(MessagesState)

def agent_node(state: MessagesState):
    print("AGENT THINKING T-T")
    response = llm_with_tools.invoke(state["messages"])
    return {"messages": [response]}

tool_node = ToolNode(tools)

workflow.add_node("agent", agent_node)
workflow.add_node("tools", tool_node)
workflow.set_entry_point("agent")

workflow.add_conditional_edges(
    "agent",
    tools_condition,
    {
        "tools": "tools",
        "__end__": END,
    },
)

# After a tool runs, it ALWAYS goes back to the agent to read the result
workflow.add_edge("tools", "agent")
