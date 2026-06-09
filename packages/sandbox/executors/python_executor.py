import os
import subprocess
import logging
import docker
from docker.errors import ContainerError, ImageNotFound

from .base import BaseExecutor, ExecutionResult
from ..policies.limits import RESOURCE_LIMITS, TIMEOUTS, MAX_OUTPUT_BYTES

logger = logging.getLogger(__name__)

SANDBOX_IMAGE = "copilot-sandbox-python:latest"
SANDBOX_ENABLED = os.environ.get("SANDBOX_ENABLED", "false").lower() == "true"

