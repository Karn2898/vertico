import docker
import logging
from typing import Optional

logger = logging.getLogger(__name__)

LIMITS = {
    "mem_limit": "256m",
    "cpu_period": 100_000,
    "cpu_quota": 50_000,       # 50% of one CPU
    "pids_limit": 64,
    "network_disabled": True,  
}

class SandboxManager:

    def __init__(self):
        try:
            self.client=docker.from_env()
        except Exception as e:
            logger.warning(f"Docker not available :{e}, sandbox disabled ")
            self.client=None

    def run_code(
            self,
            code: str,
            language: str="python",
            timeout :int=10,
            filename:Optional[str]=None,

    ):
        if not self.client:
            return self._fallback_run(code , timeout)

        image=f"vertico-sandbox-{language}"
        command = self._build_command(code, language, filename)
        try:
            
             container = self.client.containers.run(
                image=image,
                command=command,
                detach=False ,
                remove=True ,
                stdout=True,
                stderr=True,
                timeout=timeout,
                **LIMITS,
             )

            return {
                "stdout": container.decode("utf-8") if container else "",
                "stderr": "",
                "exit_code": 0,
            }
    
        except docker.errors.ContainerError as e:
            return{
                "stdout": "",
                "stderr": e.stderr.decode("utf-8") if e.stderr else str(e),
                "exit_code": e.exit_status,
            }
    
        except Exception as e:
            logger.error(f"Sandbox error: {e}")
            return {"stdout": "", "stderr": str(e), "exit_code": 1}
    
def _build_comand(
        self , 
        code:str ,
        language: str ,
        filename: Optional[str]=None,
):
    
    if language == "python",
        escaped=code.replace('"', '\\"')
        return f'python3 -c "{escaped}"'
    if language in ("node ", "javascript"):
        escaped=code.replace('"', '\\"')
        return f'node -e "{escaped}"'
    return f'echo "Unsupported language: {language}" && exit 1'
def _fallback_run(self , code:str , timeout:int):
    import subbprocess
    logger.warning("running code without sandbox, this is not secure!")
    try:
        result=subprocess.rn(
            ["python", "-c", code],
            capture_output=True,
            text=True,
            timeout=timeout,
        )

        return {
                "stdout": result.stdout,
                "stderr": result.stderr,
                "exit_code": result.returncode,
            }
    except subprocess.TimeoutExpired as e:
        return {"stdout":"","stderr": "Timeout","exit_code":1}

sandbox=SandboxManager()
