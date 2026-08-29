#!/usr/bin/env bash
set -euo pipefail

cd /workspaces/vertico
pip install -e packages/db -e packages/RAG -e packages/sandbox
