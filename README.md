# vertico
AI coding assistant to be used in IDE

The final architecture would look like:

copilot-agent/
├── apps/
│   ├── ide-extension/                 # VS Code extension / JetBrains plugin later
│   │   ├── src/
│   │   │   ├── extension.ts           # command registrations, LSP hooks, webview bridge
│   │   │   ├── chat/
│   │   │   ├── diff/
│   │   │   ├── context/
│   │   │   └── services/
│   │   ├── webview/
│   │   │   ├── src/                   # React/Tailwind UI
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   └── lib/
│   │   └── package.json
│   │
│   ├── api/
│   │   ├── app/
│   │   │   ├── main.py                # FastAPI entry
│   │   │   ├── routes/
│   │   │   │   ├── chat.py
│   │   │   │   ├── agent.py
│   │   │   │   ├── sessions.py
│   │   │   │   ├── diffs.py
│   │   │   │   └── health.py
│   │   │   ├── schemas/
│   │   │   ├── services/
│   │   │   ├── core/
│   │   │   └── middleware/
│   │   └── pyproject.toml
│   │
│   └── worker/
│       ├── runner.py                  # async jobs, background graph runs
│       ├── sandbox_manager.py
│       └── task_handlers/
│
├── packages/
│   ├── agent-core/
│   │   ├── graphs/
│   │   │   ├── coding_graph.py
│   │   │   ├── planner_graph.py
│   │   │   ├── bugfix_graph.py
│   │   │   └── review_graph.py
│   │   ├── nodes/
│   │   │   ├── intake.py
│   │   │   ├── planner.py
│   │   │   ├── retriever.py
│   │   │   ├── codegen.py
│   │   │   ├── patcher.py
│   │   │   ├── test_runner.py
│   │   │   ├── linter.py
│   │   │   ├── reflect.py
│   │   │   └── finalize.py
│   │   ├── edges/
│   │   │   └── routing.py
│   │   ├── state/
│   │   │   ├── agent_state.py
│   │   │   ├── session_state.py
│   │   │   └── plan_state.py
│   │   ├── prompts/
│   │   ├── tools/
│   │   │   ├── repo_search.py
│   │   │   ├── read_file.py
│   │   │   ├── write_file.py
│   │   │   ├── grep_codebase.py
│   │   │   ├── run_tests.py
│   │   │   ├── run_linter.py
│   │   │   ├── git_diff.py
│   │   │   ├── symbols.py
│   │   │   └── terminal.py
│   │   ├── memory/
│   │   │   ├── short_term.py
│   │   │   ├── long_term.py
│   │   │   └── summarizer.py
│   │   └── evaluation/
│   │       ├── offline_eval.py
│   │       ├── traces.py
│   │       └── metrics.py
│   │
│   ├── rag/
│   │   ├── indexers/
│   │   ├── embedders/
│   │   ├── chunkers/
│   │   ├── retrievers/
│   │   └── rankers/
│   │
│   ├── sandbox/
│   │   ├── docker/
│   │   │   ├── base.Dockerfile
│   │   │   ├── python.Dockerfile
│   │   │   ├── node.Dockerfile
│   │   │   └── runner.sh
│   │   ├── executors/
│   │   └── policies/
│   │
│   ├── db/
│   │   ├── models/
│   │   ├── migrations/
│   │   ├── repositories/
│   │   └── vector/
│   │
│   └── shared/
│       ├── config/
│       ├── logging/
│       ├── security/
│       └── utils/
│
├── infra/
│   ├── docker/
│   │   ├── docker-compose.yml
│   │   ├── api.Dockerfile
│   │   ├── worker.Dockerfile
│   │   └── nginx.conf
│   ├── k8s/                           # optional later
│   └── terraform/                     # optional later
│
├── data/
│   ├── repos/
│   ├── indexes/
│   └── traces/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── evals/
│   └── fixtures/
│
├── .env.example
├── Makefile
├── README.md
└── langgraph.json                     # if using LangGraph deployment patterns 

to run the test : /workspaces/vertico/vertico/bin/python test_agent.py