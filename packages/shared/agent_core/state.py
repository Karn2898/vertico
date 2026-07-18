
import ast
from typing import TypedDict

from langchain_core.prompts import ChatPromptTemplate


class RefactorState(TypedDict):
    original_code: str
    review_notes: str
    refactored_code: str
    errors: str 
    iterations: int


class BugfixState(TypedDict):
    original_code: str
    error_message: str
    review_notes: str
    refactored_code: str
    fixed_code: str
    errors: str
    iterations: int


def code_linter(state: RefactorState):
    """checks the refractor code for  syntax errors."""
    print("LINTING CODE")
    code = state["refactored_code"]
    iterations = state.get("iterations", 0)

    try:
        ast.parse(code)
        return {"errors": None, "iterations": iterations + 1}
    except SyntaxError as e:
        error_msg = f"syntax error on line {e.lineno}: {e.msg}"
        print(f" Found error :{error_msg}")
        return {"errors": error_msg, "iterations": iterations + 1}

def code_review(state: RefactorState):
    """reviews the refactored code and provides feedback."""
    print("REVIEWING CODE")
    from .config import llm

    prompt = ChatPromptTemplate.from_messages([
        ("system", "you are a strict senior python engineer . review the provided  code smellls , poor naming , violations , inefficiencies , output ONLY your review notes as a bulleted list ."),
        ("user", "{code}")
    ])

    chain = prompt | llm
    response = chain.invoke({"code": state["original_code"]})

    return {"review_notes": response.content}

def code_refactorer(state: RefactorState):
    print(" REFRACTORING CODE T-T")
    from .tools import llm_with_tools

    error_feedback = ""
    if state.get("errors"):
        error_feedback = f" The code has the following syntax errors : {state['errors']} . Please fix them in the refactored code. "
    prompt = ChatPromptTemplate.from_messages([
        ("system", "you are a senior python engineer . refactor the provided code to improve its readability , maintainability and performance based on the review notes and error feedback. output only the refactored code without any explanations."),
        ("user", "Here is the original code : {code} . Here are the review notes : {review_notes} . Here is the error feedback : {error_feedback}")
    ])

    chain = prompt | llm_with_tools
    response = chain.invoke({
        "code": state["original_code"],
        "review_notes": state["review_notes"],
        "error_feedback": error_feedback,
    })

    clean_code = response.content.replace("```python", "").replace("```", "").strip()
    return {"refactored_code": clean_code}


def code_fixer(state: BugfixState):
    print("FIXING BUG")
    from .tools import llm_with_tools

    prompt = ChatPromptTemplate.from_messages([
        ("system", "you are a senior python engineer. fix the provided code so that the following error no longer occurs. output only the fixed code without any explanations."),
        ("user", "Here is the original code : {code} . Here is the error to fix : {error_message}")
    ])

    chain = prompt | llm_with_tools
    response = chain.invoke({
        "code": state["original_code"],
        "error_message": state.get("error_message", ""),
    })

    clean_code = response.content.replace("```python", "").replace("```", "").strip()
    return {"fixed_code": clean_code}

    