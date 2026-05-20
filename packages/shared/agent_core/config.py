import os
import ast
from typing import TypedDict

from langgraph.graph import StateGraph, MessagesState, END
from langgraph.prebuilt import ToolNode, tools_condition
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.tools import tool

# Read sensitive configuration from environment rather than hardcoding.
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")

# LLM initialization — keep after configuration so runtime env values are used.
llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0.7
)