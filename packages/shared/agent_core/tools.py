import subprocess

from langchain_core.tools import tool
from .config import llm

try:
    from sandbox.executors.python_executor import PythonExecutor
except Exception:
    PythonExecutor = None


_python_executor = PythonExecutor() if PythonExecutor is not None else None


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
        with open(filename, "r", encoding="utf-8") as file:
            code = file.read()
    except Exception as e:
        return f"failed to run : {str(e)}"

    if _python_executor is not None:
        try:
            result = _python_executor.run(code, timeout=5)
            mode = "sandboxed" if result.sandbox_enabled else "dev-subprocess"

            if result.timed_out:
                return f"[{mode}] Execution timed out"
            if result.success:
                return f"[{mode}] Success:\n{result.stdout}"
            return f"[{mode}] Error (exit {result.exit_code}):\n{result.stderr}"
        except Exception:
            pass

    try:
        result = subprocess.run(
            ["python3", filename],
            capture_output=True,
            text=True,
            timeout=5,
        )

        if result.returncode == 0:
            return f"[dev-subprocess] Success:\n{result.stdout}"
        return f"[dev-subprocess] Error (exit {result.returncode}):\n{result.stderr}"
    except Exception as e:
        return f"failed to run : {str(e)}"


tools = [write_python_file, execute_python_file]
llm_with_tools = llm.bind_tools(tools)