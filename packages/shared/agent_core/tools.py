import subprocess


@tool
def write_python_file(filename: str, code: str):
    """Writes a Python file with the given filename and code.

    Args:
        filename (str): The name of the Python file to be created.
        code (str): The code to be written into the Python file.

    Use this once you have finished refactoring.
    """
    if not filename.endswith(".py"):
        filename += ".py"

    with open(filename, 'w') as file:
        file.write(code)
    return f"Python file '{filename}' has been written successfully."


@tool
def execute_python_file(filename: str):
    """Executes a python file with the given filename.
    Returns the output or error. Use this to verify the refactored code runs.
    """
    try:
        result = subprocess.run(
            ["python3", filename],
            capture_output=True,
            text=True,
            timeout=5,
        )

        if result.returncode == 0:
            return f"execution success :\n{result.stdout}"
        else:
            return f"execution error : \n{result.stderr}"
    except Exception as e:
        return f"failed to run : {str(e)}"
    
tools=[write_python_file , execute_pytho_file]
llm_with_tools=llm.bind_tools(tools)