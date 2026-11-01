import os
import sys
import subprocess
import logging
import docker
from docker.errors import ContainerError, ImageNotFound

from .base import BaseExecutor, ExecutionResult
from ..policies.limit import (
    RESOURCE_LIMITS,
    TIMEOUTS,
    MAX_OUTPUT_BYTES,
    ALLOWED_WRITE_PATHS,
    BLOCKED_COMMANDS,
    validate_code_against_policy,
)

logger = logging.getLogger(__name__)

SANDBOX_IMAGE = "vertico-sandbox-python:latest"
SANDBOX_ENABLED = os.environ.get("SANDBOX_ENABLED", "false").lower() == "true"


class PythonExecutor(BaseExecutor):
  

    def __init__(self):
        self.sandbox_enabled = SANDBOX_ENABLED
        if self.sandbox_enabled:
            try:
                self.client = docker.from_env()
                self._ensure_image()
            except Exception as e:
                logger.warning(f"Docker unavailable, falling back to subprocess: {e}")
                self.sandbox_enabled = False
                self.client = None
        else:
            logger.warning(
                "SANDBOX_ENABLED=false: PythonExecutor running UNSANDBOXED "
                "via plain subprocess fallback. Set SANDBOX_ENABLED=true "
                "and build the sandbox image for isolated execution."
            )

    def run(self, code: str, timeout: int = None) -> ExecutionResult:
        timeout = timeout or TIMEOUTS["python"]
        try:
            validate_code_against_policy(code)
        except ValueError as exc:
            return ExecutionResult(
                stdout="",
                stderr=f"[policy] {exc}",
                exit_code=1,
                sandbox_enabled=self.sandbox_enabled,
            )
        if self.sandbox_enabled:
            return self._run_sandboxed(code, timeout)
        return self._run_subprocess(code, timeout)

    def _validate_writes(self, code: str) -> str | None:
        """Return a policy error message if code writes outside ALLOWED_WRITE_PATHS."""
        import re
        open_pattern = re.compile(
            r"open\s*\(\s*['\"]([^'\"]+)['\"]\s*,\s*['\"]?([wax]+)['\"]?",
        )
        for match in open_pattern.finditer(code):
            target = match.group(1)
            if not any(target.startswith(p) for p in ALLOWED_WRITE_PATHS):
                return f"write target outside allowed paths {ALLOWED_WRITE_PATHS}: {target}"
        return None


    def _run_sandboxed(self, code: str, timeout: int) -> ExecutionResult:
        write_violation = self._validate_writes(code)
        if write_violation:
            return ExecutionResult(
                stdout="",
                stderr=f"[policy] {write_violation}",
                exit_code=1,
                sandbox_enabled=True,
            )
        try:
            output = self.client.containers.run(
                image=SANDBOX_IMAGE,   
                environment={
                    "SANDBOX_CODE": code,
                    "SANDBOX_LANG": "python",
                },
                detach=False,
                remove=True,
                stdout=True,
                stderr=True,
                timeout=timeout,
                tmpfs={"/tmp": "size=32m,noexec"},   # writable tmpfs only
                **RESOURCE_LIMITS,
            )

            stdout = self._truncate(
                output.decode("utf-8") if output else "",
                MAX_OUTPUT_BYTES,
            )
            return ExecutionResult(
                stdout=stdout,
                stderr="",
                exit_code=0,
                sandbox_enabled=True,
            )

        except ContainerError as e:
            stderr = e.stderr.decode("utf-8") if e.stderr else str(e)
            return ExecutionResult(
                stdout="",
                stderr=self._truncate(stderr, MAX_OUTPUT_BYTES),
                exit_code=e.exit_status,
                sandbox_enabled=True,
            )

        except Exception as e:
            if "timeout" in str(e).lower():
                return ExecutionResult(
                    stdout="",
                    stderr="Execution timed out",
                    exit_code=1,
                    timed_out=True,
                    sandbox_enabled=True,
                )
            logger.error(f"Sandbox error: {e}")
            return ExecutionResult(
                stdout="",
                stderr=str(e),
                exit_code=1,
                sandbox_enabled=True,
            )

    # --- Subprocess (dev) ---

    def _run_subprocess(self, code: str, timeout: int) -> ExecutionResult:
        write_violation = self._validate_writes(code)
        if write_violation:
            return ExecutionResult(
                stdout="",
                stderr=f"[policy] {write_violation}",
                exit_code=1,
                sandbox_enabled=False,
            )
        logger.warning("Running code WITHOUT sandbox — dev mode only")
        try:
            result = subprocess.run(
                [sys.executable, "-c", code],
                capture_output=True,
                text=True,
                timeout=timeout,
            )
            return ExecutionResult(
                stdout=self._truncate(result.stdout, MAX_OUTPUT_BYTES),
                stderr=self._truncate(result.stderr, MAX_OUTPUT_BYTES),
                exit_code=result.returncode,
                sandbox_enabled=False,
            )
        except subprocess.TimeoutExpired:
            return ExecutionResult(
                stdout="",
                stderr="Execution timed out",
                exit_code=1,
                timed_out=True,
                sandbox_enabled=False,
            )

    def _ensure_image(self):
        """Check sandbox image exists - fail loud on startup if missing."""
        try:
            self.client.images.get(SANDBOX_IMAGE)
        except ImageNotFound:
            raise RuntimeError(
                f"Sandbox image '{SANDBOX_IMAGE}' not found. "
                f"Run: make sandbox-build"
            )
        """
