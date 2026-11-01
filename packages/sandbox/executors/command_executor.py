import os
import sys
import subprocess
import shlex
import uuid
import logging
import docker
from dataclasses import dataclass, field
from typing import Optional
from docker.errors import ContainerError, ImageNotFound

from .base import BaseExecutor, ExecutionResult
from ..policies.limit import (
    RESOURCE_LIMITS,
    MAX_OUTPUT_BYTES,
    ALLOWED_WRITE_PATHS,
    BLOCKED_COMMANDS,
    ALLOWED_EXECUTABLES,
    is_allowed_command,
    validate_command_against_policy,
)

logger = logging.getLogger(__name__)

SANDBOX_IMAGE = "vertico-sandbox-command:latest"
SANDBOX_ENABLED = os.environ.get("SANDBOX_ENABLED", "false").lower() == "true"
VERTICO_ALLOW_HOST_EXEC = os.environ.get("VERTICO_ALLOW_HOST_EXEC", "false").lower() == "true"


@dataclass
class CommandApproval:
    id: str
    command: str
    status: str = "pending"  # pending, approved, rejected
    result: Optional[ExecutionResult] = None


_PENDING_APPROVALS: dict[str, CommandApproval] = {}


class CommandExecutor(BaseExecutor):
    
    def __init__(self):
        self.sandbox_enabled = SANDBOX_ENABLED
        if self.sandbox_enabled:
            try:
                self.client = docker.from_env()
                self._ensure_image()
            except Exception as e:
                logger.warning(f"Docker unavailable: {e}")
                self.sandbox_enabled = False
                self.client = None
        else:
            logger.warning(
                "SANDBOX_ENABLED=false: CommandExecutor will require approval for non-allowlisted commands. "
                "Set SANDBOX_ENABLED=true and build the sandbox image for isolated execution."
            )
            self.client = None

    def run(self, command: str, timeout: int = 30) -> ExecutionResult:
        # Check for shell metacharacters
        if self._has_metacharacters(command):
            return ExecutionResult(
                stdout="",
                stderr="[policy] Shell metacharacters not allowed (; && || | ` $() > <)",
                exit_code=1,
                sandbox_enabled=self.sandbox_enabled,
            )

        # Parse command
        try:
            parts = shlex.split(command)
        except ValueError as e:
            return ExecutionResult(
                stdout="",
                stderr=f"[policy] Invalid command syntax: {e}",
                exit_code=1,
                sandbox_enabled=self.sandbox_enabled,
            )

        if not parts:
            return ExecutionResult(
                stdout="",
                stderr="[policy] Empty command",
                exit_code=1,
                sandbox_enabled=self.sandbox_enabled,
            )

        executable = parts[0]

        # Check against blocked commands
        if executable in BLOCKED_COMMANDS:
            return ExecutionResult(
                stdout="",
                stderr=f"[policy] Blocked command: {executable}",
                exit_code=1,
                sandbox_enabled=self.sandbox_enabled,
            )

        # Check if command is allowlisted
        if not is_allowed_command(command):
            approval_id = str(uuid.uuid4())[:8]
            _PENDING_APPROVALS[approval_id] = CommandApproval(
                id=approval_id,
                command=command,
            )
            return ExecutionResult(
                stdout=json.dumps({"status": "needs_approval", "id": approval_id}),
                stderr="",
                exit_code=0,
                sandbox_enabled=self.sandbox_enabled,
            )

        # Check Docker availability
        if self.sandbox_enabled:
            return self._run_sandboxed(command, timeout)
        elif VERTICO_ALLOW_HOST_EXEC:
            logger.warning("Running command on host (VERTICO_ALLOW_HOST_EXEC=true)")
            return self._run_host(command, timeout)
        else:
            return ExecutionResult(
                stdout="",
                stderr="Docker unavailable and VERTICO_ALLOW_HOST_EXEC not set. Enable Docker or set VERTICO_ALLOW_HOST_EXEC=true.",
                exit_code=1,
                sandbox_enabled=False,
            )

    def _run_sandboxed(self, command: str, timeout: int) -> ExecutionResult:
        try:
            output = self.client.containers.run(
                image=SANDBOX_IMAGE,
                command=["sh", "-c", command],
                detach=False,
                remove=True,
                stdout=True,
                stderr=True,
                timeout=timeout,
                tmpfs={"/tmp": "size=32m,noexec"},
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

    def _run_host(self, command: str, timeout: int) -> ExecutionResult:
        logger.warning("Running command on host (VERTICO_ALLOW_HOST_EXEC=true)")
        try:
            result = subprocess.run(
                shlex.split(command),
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
        except Exception as e:
            return ExecutionResult(
                stdout="",
                stderr=str(e),
                exit_code=1,
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


def approve_command(approval_id: str) -> ExecutionResult:
    """Approve a pending command and execute it."""
    approval = _PENDING_APPROVALS.get(approval_id)
    if not approval:
        return ExecutionResult(
            stdout="",
            stderr=f"Approval not found: {approval_id}",
            exit_code=1,
        )

    if approval.status != "pending":
        return ExecutionResult(
            stdout="",
            stderr=f"Already processed: {approval.status}",
            exit_code=1,
        )

    approval.status = "approved"
    executor = CommandExecutor()
    result = executor.run(approval.command)
    approval.result = result
    return result


def reject_command(approval_id: str) -> ExecutionResult:
    """Reject a pending command."""
    approval = _PENDING_APPROVALS.get(approval_id)
    if not approval:
        return ExecutionResult(
            stdout="",
            stderr=f"Approval not found: {approval_id}",
            exit_code=1,
        )

    if approval.status != "pending":
        return ExecutionResult(
            stdout="",
            stderr=f"Already processed: {approval.status}",
            exit_code=1,
        )

    approval.status = "rejected"
    return ExecutionResult(
        stdout="",
        stderr="Command rejected by user",
        exit_code=1,
        sandbox_enabled=False,
    )


def get_approval_status(approval_id: str) -> dict:
    approval = _PENDING_APPROVALS.get(approval_id)
    if not approval:
        return {"error": f"Approval not found: {approval_id}"}
    return {
        "id": approval.id,
        "command": approval.command,
        "status": approval.status,
    }


def _has_metacharacters(command: str) -> bool:
    """Check for shell metacharacters that could be used for injection."""
    import re
    # Check for: ; && || | ` $() > <
    metachar_pattern = re.compile(r'[;|`$<>]|&&|\|\|')
    return bool(metachar_pattern.search(command))