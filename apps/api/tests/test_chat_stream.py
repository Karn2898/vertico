import asyncio

from apps.api.apps.routes import chat


def test_stream_chat_uses_session_llm(monkeypatch):
    class FakeChunk:
        content = "hello"

    class FakeLLM:
        def __init__(self):
            self.calls = []

        async def astream(self, messages):
            self.calls.append(messages)
            yield FakeChunk()

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
