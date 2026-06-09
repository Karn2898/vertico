FROM debian:bookworm-slim

RUN useradd -m -u 1001 -s /bin/false sandbox
RUN mkdir /sandbox && chown sandbox:sandbox /sandbox

WORKDIR /sandbox
USER sandbox