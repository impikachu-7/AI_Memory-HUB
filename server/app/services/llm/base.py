"""LLM provider abstraction base class.

All concrete providers must implement validate_credentials, list_models,
generate, and stream.  Error contract:
  - Invalid/expired key  → HTTPException(401, "Provider authentication failed")
  - Rate limit           → HTTPException(429, "Provider rate limit reached")
  - Model not found      → HTTPException(400, "Model not available from provider")
  - Unreachable/timeout  → HTTPException(503, "Provider temporarily unavailable")
  - Any other error      → HTTPException(502, "Provider returned an unexpected error")

SECURITY: exception messages must NEVER contain the API key string.
"""
from abc import ABC, abstractmethod
from collections.abc import Iterator


class LLMProvider(ABC):
    """Common interface for every LLM backend."""

    @abstractmethod
    def validate_credentials(self, api_key: str | None) -> None:
        """Raise HTTPException if the key is invalid or the provider is unreachable."""

    @abstractmethod
    def list_models(self, api_key: str | None) -> list[dict]:
        """Return a list of dicts with at minimum {model_key, display_name}.

        Raise HTTPException(503) if the provider endpoint is unreachable.
        """

    @abstractmethod
    def generate(self, messages: list[dict], api_key: str | None, model_key: str) -> str:
        """Non-streaming generation.  Return the complete response string."""

    @abstractmethod
    def stream(self, messages: list[dict], api_key: str | None, model_key: str) -> Iterator[str]:
        """Streaming generation.  Yield text chunks as they arrive.

        Raise an appropriate HTTPException on provider error.
        """
