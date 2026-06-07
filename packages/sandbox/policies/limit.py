
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