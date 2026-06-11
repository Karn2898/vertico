import os
import subprocess
import logging
import docker
from docker.errors import ContainerError, ImageNotFound

from .base import BaseExecutor, ExecutionResult
from ..policies.limits import RESOURCE_LIMITS, TIMEOUTS, MAX_OUTPUT_BYTES

logger = logging.getLogger(__name__)

SANDBOX_IMAGE = "copilot-sandbox-node:latest"
SANDBOX_ENABLED = os.environ.get("SANDBOX_ENABLED", "false").lower() == "true"

class NodeExecutor(BaseExecutor):
    def __init__(BaseExeutor):
        self.sandbox_enabled=SANDBOX_ENABLED
        if self.sandbox_enabled:
            try:
                self.client = docker.from_env()
                self._ensure_imege()
            except Exception as e:
                logger.warning(f"Docker unavailable, falling back to subprocess: {e}")
                self.sandbox_enabled=False
                self.client=None
    def run(self, code:Str , timeout:int=None):
        timeout=timeout 
        if self.sandbox_enabled:
            return self.run_sandboxed(code, timeout)
        return self.run_subprocess(code, timeout)
    
    def _run_sandboxed(self , code:Str , timeout:int):
        try:
            output=self.client.containers.run(
                image=SANDBOX_IMAGE,
                environment={
                    "SANDBOX_CODE":code,
                    "SANDBOX_LANG": "node",
                },
                detach=False,
                remove=True,
                stdout=True,
                stderr=True,
                timeout=timeout,
                tmpfs={"/tmp": "size=32m,noexec"},
                **RESOURCE_LIMITS,
            )            
            stdout=self._truncate(
                output.decode("utf-8") if output else "",
                MAX_OUTPUT_BYTES
            )
            return ExecutionResult(
                stdout=stdout,
                stderr='',
                exit_code=0,
                sandbox_enabled=True,
            )
        except ContainerError as e:
            stderr=e.stderr.decode("utf-8") if e.stderr else str(e)
            return ExecutiojnResult(
                stdout='',
                stderr=self._truncate(stderr, MAX_OUTPUT_BYTES),
                exit_code=e.exit_status,
                sandbox_enabled=True,
            )
        except Exception as e:
            if"timeout" in str(e).lower():
                return ExecutionResult(
                    stdout='',
                    stderr='Execution timed out',
                    exit_code=1,
                    timed_out=True,
                    sandbox_enabled=True,
                )
            
            def _run_subprocess(self , code : str , timeout:int):
                logger.warning("Running Node without sandbox")
                try:
                    result=subprocess.run(
                        ["node", "-e" , code],
                        capture_output=True,
                        text=True,
                        timeout=timeout,
                  )
                    
                    return ExecutionResult(
                        stdout=self._truncate(result.stdout,MAX_OUTPUT_BYTES),
                        stderr=self._truncate(result.stderr,MAX_OUTPUT_BYTES),
                        exit_code=result.returncode,
                        sandbox_enabled=False,
                    )
                except subprocess.TimeoutExpired:
                    return ExecutionResult(
                        stdout='',
                        stderr='Execution timed out',
                        exit_code=1,
                        timed_out=True,
                        sandbox_enabled=False,
                    )
                
    def _ensure_image(self):
        try:
            self.client.images.get(SANDBOX_IMAGE)
        except ImageNotFound:
            raise RuntimeError(
                f"Sandbox image '{SANDBOX_IMAGE}' not found. "
                f"Run: make sandbox-build"
            )
        