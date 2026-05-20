
class RefactorState(TypedDict):
    original_code: str
    review_notes: str
    refactored_code: str
    errors: str  
    iterations: int 


def code_linter(state: RefractorState):
    """checks the refractor code for error syntax errors."""
    print("LINTING CODE")
    code=state["refactored_code"]
    iterations=state.get("iterations",0)

    try:
        ast.parse(code)
        return {"errors":"none","iterations":iterations +1}
    except SyntaxError as e:
        error_msg=f"syntax error on line {e.lineno}: {e.msg}"
        print(f" Found error :{error_msg}")
        return {"errors": error_msg , "iterations":iterations+1}

def code_review(state: RefactorState):
    """reviews the refactored code and provides feedback."""
    print("REVIEWING CODE")
    prompt=ChatPromptTemplate.from_messages([
        ("system", "you are a strict senior python engineer . review the provided  code smellls , poor naming , violations , inefficiencies , output ONLY your review notes as a bulleted list ."),
        ("user","{code}")
    ])

    chain=prompt|llm
    response=chain.invoke({"code":state["original_code"]})

    return {"review_notes": response.content}

def code_refractor(state: RefactorState):
    print(" REFRACTORING CODE T-T")

    error_feedback=""
    if state.get("errors") and  state["errors"]!= "None":
        error_feedback=f" The code has the following syntax errors : {state['errors']} . Please fix them in the refactored code. "
    prompt=ChatPromptTemplate.from_messages([
        ("system", "you are a senior python engineer . refactor the provided code to improve its readability , maintainability and performance based on the review notes and error feedback. output only the refactored code without any explanations."),
        ("user","Here is the original code : {code} . Here are the review notes : {review_notes} . Here is the error feedback : {error_feedback}")
    ])

    chain=prompt|llm_with_tools
    response=chain.invoke({
        "code":state["orignal_code"],
        "notes":state["review_notes"],
        "feedback":error_feedback
    })

    clean_code=respone.content.replace("```python","").replace("```","").strip()
    return {"refactored_code":clean_code}

    