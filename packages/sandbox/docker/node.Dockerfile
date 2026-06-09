FROM copilot-sandbox-base:latest

USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get purge -y curl wget npm

USER sandbox

COPY packages/sandbox/docker/runner.sh /runner.sh
ENTRYPOINT ["/bin/sh", "/runner.sh"]