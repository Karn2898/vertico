from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class ExecutionResult:
    stdout: str
    stderr: str
    exit_code: int
    timed_out: bool = False
    sandbox_enabled: bool = True

    @property
    def success(self) -> bool:
        return self.exit_code == 0 and not self.timed_out

    def to_dict (self):
        return {
            "stdout": self.stdout,
            "stderr": self.stderr,
            "exit_code": self.exit_code,
            "timed_out": self.timed_out,
            "success": self.success,
            "sandbox_enabled": self.sandbox_enabled,
        }

class BaseExecutor(ABC):
    @abstractmethod
    def run(self, code: str, timeout: int) -> ExecutionResult:
        pass

    def _truncate(self, output: str, max_bytes: int = 10_000) -> str:
        if len(output) > max_bytes:
            return output[:max_bytes] + "\n... [truncated]"
        return output