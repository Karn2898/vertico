import asyncio

from apps.api.apps.routes import chat


def test_stream_chat_uses_session_llm(monkeypatch):
    class FakeResponse:
        content = "hello"
        tool_calls = []

    class FakeLLM:
        def __init__(self):
            self.calls = []


        async def ainvoke(self, messages):
            self.calls.append(messages)
            return FakeResponse()

    fake_llm = FakeLLM()
    monkeypatch.setattr(chat, "_get_llm", lambda session: fake_llm)

    chat.sessions["sess-1"] = {
        "agent_state": {
            "iterations": 1,
            "errors": None,
            "review_notes": "reviewed",
        }
    }
    chat.chat_histories["sess-1"] = [
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "hello there"},
    ]

    async def run():
        chunks = []
        async for chunk in chat._stream_chat("sess-1", "question"):
            chunks.append(chunk)
        assert any("hello" in chunk for chunk in chunks)
        assert fake_llm.calls

    asyncio.run(run())


def test_stream_chat_executes_requested_workspace_tool(monkeypatch):
    class FakeResponse:
        def __init__(self, content="", tool_calls=None):
            self.content = content
            self.tool_calls = tool_calls or []

    class FakeLLM:
        def __init__(self):
            self.calls = 0

        async def ainvoke(self, messages):
            self.calls += 1
            if self.calls == 1:
                return FakeResponse(
                    tool_calls=[
                        {
                            "id": "call-1",
                            "name": "read_code_file",
                            "args": {
                                "path": "packages/shared/agent_core/state.py",
                                "start_line": 1,
                                "end_line": 1,
                            },
                        }
                    ]
                )
            return FakeResponse("I read the file.")

    fake_llm = FakeLLM()
    monkeypatch.setattr(chat, "_get_llm", lambda session: fake_llm)
    chat.sessions["tool-sess"] = {
        "agent_state": {"iterations": 0, "errors": None, "review_notes": ""}
    }
    chat.chat_histories["tool-sess"] = []

    async def run():
        chunks = [chunk async for chunk in chat._stream_chat("tool-sess", "read the file")]
        assert any("I read the file." in chunk for chunk in chunks)
        assert fake_llm.calls == 2

    asyncio.run(run())


def test_stream_chat_uses_alternate_workspace_root(tmp_path, monkeypatch):
    external_file = tmp_path / "main.py"
    external_file.write_text("print('hello from remote workspace')\n", encoding="utf-8")

    class FakeResponse:
        def __init__(self, content="", tool_calls=None):
            self.content = content
            self.tool_calls = tool_calls or []

    class FakeLLM:
        def __init__(self):
            self.calls = 0

        async def ainvoke(self, messages):
            self.calls += 1
            if self.calls == 1:
                return FakeResponse(
                    tool_calls=[
                        {
                            "id": "call-1",
                            "name": "read_code_file",
                            "args": {
                                "path": "main.py",
                                "start_line": 1,
                                "end_line": 10,
                            },
                        }
                    ]
                )
            return FakeResponse("Read external file successfully.")

    fake_llm = FakeLLM()
    monkeypatch.setattr(chat, "_get_llm", lambda session: fake_llm)
    chat.sessions["ext-sess"] = {
        "workspace_root": str(tmp_path),
        "agent_state": {"iterations": 0, "errors": None, "review_notes": ""},
    }
    chat.chat_histories["ext-sess"] = []

    async def run():
        chunks = [
            chunk
            async for chunk in chat._stream_chat("ext-sess", "read proxy server main.py")
        ]
        assert any("Read external file successfully." in chunk for chunk in chunks)
        assert fake_llm.calls == 2

    asyncio.run(run())

