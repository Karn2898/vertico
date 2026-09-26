import os
from typing import Any, Optional

from langchain_openai import ChatOpenAI

NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY")

# Speed-mode model mapping (Gemini).
# "fast"  -> cheaper/faster model, used for quick answers.
# "thorough" -> higher-quality model, used for full reasoning.
GEMINI_MODELS_BY_MODE = {
    "fast": "gemini-2.0-flash-lite",
    "thorough": "gemini-2.5-pro",
}


def get_gemini_model_for_mode(mode: Optional[str]) -> str:
    """Map a speed mode ('fast' | 'thorough') to a Gemini model.
    Unknown/missing modes default to the fast model."""
    return GEMINI_MODELS_BY_MODE.get((mode or "fast").lower(), GEMINI_MODELS_BY_MODE["fast"])


class _OpenAICompatibleLLM(ChatOpenAI):
    """LangChain-compatible wrapper around any OpenAI-compatible API (NVIDIA, OpenAI, DeepSeek)."""

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://integrate.api.nvidia.com/v1",
        model: str = "nvidia/nemotron-3.5-lightning-30b-a3b",
        **kwargs: Any,
    ):
        super().__init__(
            model=model,
            base_url=base_url,
            api_key=api_key,
            **kwargs,
        )


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
        "model": "nvidia/nemotron-3.5-lightning-30b-a3b",
        "requires_key": False,
        "extra_body": {
            "chat_template_kwargs": {"enable_thinking": True},
            "reasoning_budget": 16384,
        },
    },
    "openai": {
        "base_url": "https://api.openai.com/v1",
        "model": "gpt-4o",
        "requires_key": True,
    },
    "gemini": {
        "model": "gemini-2.0-flash",
        # per-mode defaults (speed selector); explicit llm_model still wins
        "models": GEMINI_MODELS_BY_MODE,
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
    mode: Optional[str] = None,
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
            extra_body=cfg.get("extra_body", {}),

           stream_chunk_timeout=None,
        )

    if provider == "gemini":
        if not api_key:
            raise RuntimeError("Gemini provider requires an api_key")
        # speed-mode aware: when no explicit model is pinned, pick the model
        # for the requested mode ('fast' -> gemini-2.0-flash-lite, 'thorough' -> gemini-2.5-pro).
        resolved = model or cfg.get("models", {}).get((mode or "fast").lower()) or cfg["model"]
        return _GeminiLLM(api_key=api_key, model=resolved)

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
        stream_chunk_timeout=None,
    )


def get_default_provider() -> str:
    return "nvidia"


llm = get_llm()
