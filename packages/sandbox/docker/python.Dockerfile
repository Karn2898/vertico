FROM copilot-sandbox-base:latest

USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get purge -y curl wget

USER sandbox

COPY packages/sandbox/docker/runner.sh/runner.sh
ENTRYPOINT["/bin/sh","/runner.sh"]