import os
from typing import Any, Optional

NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY")


class _OpenAICompatibleLLM:
    """Minimal wrapper around any OpenAI-compatible API (NVIDIA, OpenAI, DeepSeek)."""

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://integrate.api.nvidia.com/v1",
        model: str = "z-ai/glm-5.2",
    ):
        self.model = model
        self.base_url = base_url
        self._api_key = api_key
        self._client = None

    def _get_client(self):
        if self._client is None:
            from openai import OpenAI
            self._client = OpenAI(base_url=self.base_url, api_key=self._api_key)
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


class _GeminiLLM:
    """Wrapper around Google Generative AI (Gemini)."""

    def __init__(self, api_key: str, model: str = "gemini-2.0-flash"):
        self.model = model
        self._api_key = api_key
        self._client = None

    def _get_client(self):
        if self._client is None:
            from langchain_google_genai import ChatGoogleGenerativeAI
            self._client = ChatGoogleGenerativeAI(model=self.model, google_api_key=self._api_key)
        return self._client

    def invoke(self, messages: Any, **kwargs: Any) -> Any:
        return self._get_client().invoke(messages, **kwargs)

    def astream(self, messages: Any, **kwargs: Any):
        yield from self._get_client().stream(messages, **kwargs)


class _ClaudeLLM:
    """Wrapper around Anthropic Claude (optional)."""

    def __init__(self, api_key: str, model: str = "claude-3-5-sonnet-20240620"):
        self.model = model
        self._api_key = api_key
        self._client = None

    def _get_client(self):
        if self._client is None:
            try:
                from langchain_anthropic import ChatAnthropic
            except ImportError as exc:
                raise RuntimeError("langchain-anthropic is not installed; cannot use Claude provider") from exc
            self._client = ChatAnthropic(model=self.model, anthropic_api_key=self._api_key)
        return self._client

    def invoke(self, messages: Any, **kwargs: Any) -> Any:
        return self._get_client().invoke(messages, **kwargs)

    def astream(self, messages: Any, **kwargs: Any):
        yield from self._get_client().stream(messages, **kwargs)


_PROVIDERS = {
    "nvidia": {
        "base_url": "https://integrate.api.nvidia.com/v1",
        "model": "z-ai/glm-5.2",
        "requires_key": False,
    },
    "openai": {
        "base_url": "https://api.openai.com/v1",
        "model": "gpt-4o",
        "requires_key": True,
    },
    "gemini": {
        "model": "gemini-2.0-flash",
        "requires_key": True,
    },
    "claude": {
        "model": "claude-3-5-sonnet-20240620",
        "requires_key": True,
    },
    "deepseek": {
        "base_url": "https://api.deepseek.com/v1",
        "model": "deepseek-chat",
        "requires_key": True,
    },
}


def get_llm(
    provider: str = "nvidia",
    api_key: Optional[str] = None,
    model: Optional[str] = None,
):
    """Return an LLM instance for the requested provider."""
    provider = provider.lower()
    if provider not in _PROVIDERS:
        raise ValueError(f"Unknown provider '{provider}'. Expected one of {list(_PROVIDERS.keys())}")

    cfg = _PROVIDERS[provider]

    if provider == "nvidia":
        key = NVIDIA_API_KEY or api_key
        if not key:
            raise RuntimeError("NVIDIA_API_KEY is not set and no fallback key was provided")
        return _OpenAICompatibleLLM(
            api_key=key,
            base_url=cfg["base_url"],
            model=model or cfg["model"],
        )

    if provider == "gemini":
        if not api_key:
            raise RuntimeError("Gemini provider requires an api_key")
        return _GeminiLLM(api_key=api_key, model=model or cfg["model"])

    if provider == "claude":
        if not api_key:
            raise RuntimeError("Claude provider requires an api_key")
        return _ClaudeLLM(api_key=api_key, model=model or cfg["model"])

    # openai / deepseek / other OpenAI-compatible
    if not api_key:
        raise RuntimeError(f"{provider} provider requires an api_key")
    return _OpenAICompatibleLLM(
        api_key=api_key,
        base_url=cfg["base_url"],
        model=model or cfg["model"],
    )


def get_default_provider() -> str:
    return "nvidia"


llm = get_llm()
