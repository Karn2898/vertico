
RESOURCE_LIMITS = {
    "mem_limit": "128m",           # 128MB RAM max
    "memswap_limit": "128m",       # no swap
    "cpu_period": 100_000,
    "cpu_quota": 25_000,           # 25% of one CPU
    "pids_limit": 32,              # max processes inside container
    "network_disabled": True,      # zero network access
    "read_only": True,             # read-only filesystem
    "cap_drop": ["ALL"],           # drop all Linux capabilities
    "security_opt": ["no-new-privileges:true"],
}


TIMEOUTS = {
    "python": 10,
    "node": 10,
    "default": 10,
}

MAX_OUTPUT_BYTES = 10_000


ALLOWED_WRITE_PATHS = ["/tmp"]

BLOCKED_COMMANDS = [
    "rm", "curl", "wget", "nc", "ncat",
    "chmod", "chown", "sudo", "su",
]

# Allowlist of executables and their allowed subcommands
ALLOWED_EXECUTABLES = {
    "python": ["-c", "-m", "-u"],
    "pytest": [],
    "node": ["-e", "--version"],
    "npm": ["run", "test", "install", "ci", "--version"],
    "git": ["status", "diff", "log", "show", "branch", "remote", "config", "ls-files"],
}

# Shell metacharacters that are not allowed
METACHARACTERS = r'[;|`$<>]|&&|\|\|'


def is_allowed_command(command: str) -> bool:
    """Check if a command is allowlisted."""
    import shlex
    try:
        parts = shlex.split(command)
    except ValueError:
        return False

    if not parts:
        return False

    executable = parts[0]
    
    # Check if executable is in allowlist
    if executable not in ALLOWED_EXECUTABLES:
        return False

    # For git, validate subcommand
    if executable == "git" and len(parts) > 1:
        subcommand = parts[1]
        if subcommand not in ALLOWED_EXECUTABLES["git"]:
            return False

    return True


def _has_metacharacters(command: str) -> bool:
    """Check for shell metacharacters that could be used for injection."""
    import re
    metachar_pattern = re.compile(r'[;|`$<>]|&&|\|\|')
    return bool(metachar_pattern.search(command))


def validate_command_against_policy(command: str) -> None:
    """Validate command against policy - raises ValueError if blocked."""
    import re
    
    # Check for metacharacters
    if _has_metacharacters(command):
        raise ValueError(f"Shell metacharacters not allowed in command")

    # Check against blocked commands
    try:
        parts = shlex.split(command)
    except ValueError as e:
        raise ValueError(f"Invalid command syntax: {e}")

    if not parts:
        raise ValueError("Empty command")

    executable = parts[0]
    
    if executable in BLOCKED_COMMANDS:
        raise ValueError(f"Blocked command: {executable}")

    # Check allowlist
    if not is_allowed_command(command):
        raise ValueError(f"Command not allowlisted: {executable}")


def is_allowed_command(command: str) -> bool:
    """Check if a command is allowlisted."""
    import shlex
    try:
        parts = shlex.split(command)
    except ValueError:
        return False

    if not parts:
        return False

    executable = parts[0]
    
    # Check if executable is in allowlist
    if executable not in ALLOWED_EXECUTABLES:
        return False

    # For git, validate subcommand
    if executable == "git" and len(parts) > 1:
        subcommand = parts[1]
        if subcommand not in ALLOWED_EXECUTABLES["git"]:
            return False

    return True


def _has_metacharacters(command: str) -> bool:
    """Check for shell metacharacters that could be used for injection."""
    import re
    metachar_pattern = re.compile(r'[;|`$<>]|&&|\|\|')
    return bool(metachar_pattern.search(command))


def validate_code_against_policy(code: str) -> None:
    """Raise ValueError when code invokes a blocked command."""
    for command in BLOCKED_COMMANDS:
        if command in code:
            raise ValueError(
                f"blocked command in code: {command!r}"
            )
