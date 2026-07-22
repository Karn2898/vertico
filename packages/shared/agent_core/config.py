import os
from typing import Any

NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY")


class _NvidiaChatLLM:
    """Minimal langchain-compatible wrapper around NVIDIA's OpenAI-compatible API."""

    def __init__(self, model: str = "z-ai/glm-5.2", base_url: str = "https://integrate.api.nvidia.com/v1"):
        self.model = model
        self.base_url = base_url
        self._client = None

    def _get_client(self):
        if self._client is None:
            from openai import OpenAI
            if not NVIDIA_API_KEY:
                raise RuntimeError("NVIDIA_API_KEY is not set")
            self._client = OpenAI(base_url=self.base_url, api_key=NVIDIA_API_KEY)
        return self._client

    def invoke(self, messages: Any, **kwargs: Any) -> Any:
        client = self._get_client()
        response = client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=kwargs.get("temperature", 1),
            top_p=kwargs.get("top_p", 1),
            max_tokens=kwargs.get("max_tokens", 1024),
        )
        return response.choices[0].message

    def astream(self, messages: Any, **kwargs: Any):
        client = self._get_client()
        stream = client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=kwargs.get("temperature", 1),
            top_p=kwargs.get("top_p", 1),
            max_tokens=kwargs.get("max_tokens", 1024),
            stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta if chunk.choices else None
            if delta and getattr(delta, "content", None):
                yield delta.content


llm = _NvidiaChatLLM()
