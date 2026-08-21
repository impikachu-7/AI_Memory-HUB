"""Groq provider — OpenAI-compatible API at https://api.groq.com/openai/v1."""
import logging
from collections.abc import Iterator
from fastapi import HTTPException

from app.services.llm.base import LLMProvider

log = logging.getLogger(__name__)

_BASE_URL = "https://api.groq.com/openai/v1"


def _client(api_key: str):
    try:
        import openai
        return openai.OpenAI(api_key=api_key, base_url=_BASE_URL)
    except ImportError as exc:
        raise HTTPException(503, "openai SDK is not installed") from exc


def _safe_raise(exc: Exception) -> None:
    try:
        import openai
    except ImportError:
        raise HTTPException(503, "openai SDK is not installed") from exc

    if isinstance(exc, openai.AuthenticationError):
        raise HTTPException(401, "Provider authentication failed") from exc
    if isinstance(exc, openai.RateLimitError):
        raise HTTPException(429, "Provider rate limit reached") from exc
    if isinstance(exc, openai.NotFoundError):
        raise HTTPException(400, "Model not available from provider") from exc
    if isinstance(exc, (openai.APIConnectionError, openai.APITimeoutError)):
        raise HTTPException(503, "Provider temporarily unavailable") from exc
    if isinstance(exc, openai.BadRequestError):
        raise HTTPException(400, "Invalid request to provider") from exc
    log.error("Unexpected Groq error: %s", type(exc).__name__)
    raise HTTPException(502, "Provider returned an unexpected error") from exc


class GroqProvider(LLMProvider):
    def validate_credentials(self, api_key: str | None) -> None:
        if not api_key:
            raise HTTPException(401, "Provider authentication failed")
        try:
            _client(api_key).models.list()
        except HTTPException:
            raise
        except Exception as exc:
            _safe_raise(exc)

    def list_models(self, api_key: str | None) -> list[dict]:
        if not api_key:
            raise HTTPException(401, "Provider authentication failed")
        try:
            models = _client(api_key).models.list()
            return [
                {"model_key": m.id, "display_name": m.id, "is_local": False}
                for m in models.data
            ]
        except HTTPException:
            raise
        except Exception as exc:
            _safe_raise(exc)
            return []

    def generate(self, messages: list[dict], api_key: str | None, model_key: str) -> str:
        if not api_key:
            raise HTTPException(401, "Provider authentication failed")
        try:
            resp = _client(api_key).chat.completions.create(
                model=model_key, messages=messages
            )
            return resp.choices[0].message.content or ""
        except HTTPException:
            raise
        except Exception as exc:
            _safe_raise(exc)
            return ""

    def stream(self, messages: list[dict], api_key: str | None, model_key: str) -> Iterator[str]:
        if not api_key:
            raise HTTPException(401, "Provider authentication failed")
        try:
            with _client(api_key).chat.completions.create(
                model=model_key, messages=messages, stream=True
            ) as stream:
                for chunk in stream:
                    delta = chunk.choices[0].delta.content if chunk.choices else None
                    if delta:
                        yield delta
        except HTTPException:
            raise
        except Exception as exc:
            _safe_raise(exc)
