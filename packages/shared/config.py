from typing import TypedDict
from langgraph.graph import StateGraph , END
from langchain_google_genai import google.generativeai as gemini
from langchain_core.prompts import ChatPromptTemplate
import ast

import os

from langchain.tools import tool
import os
from langgraph.graph import StateGraph, MessagesState, END
from langgraph.prebuilt import ToolNode, tools_condition
from langchain_core.messages import HumanMessage

from langchain_google_genai import ChatGoogleGenerativeAI

os.environ["GOOGLE_API_KEY"] = "AIzaSyB8ky-MqVmskiAoI04UM4f-NDyhf8Geih8"

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0.7
)