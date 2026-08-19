"""Ollama provider — local inference server with OpenAI-compatible API.

Ollama exposes:
  - GET  {base_url}/api/tags          → list installed models
  - POST {base_url}/v1/chat/completions → OpenAI-compatible chat (via openai SDK)

No API key is required.  The api_key parameter is accepted but always ignored.
If Ollama is unreachable, a 503 is raised immediately with a safe message.
"""
import logging
from collections.abc import Iterator
from fastapi import HTTPException

from app.services.llm.base import LLMProvider

log = logging.getLogger(__name__)


def _base_url() -> str:
    from app.core.config import get_settings
    return get_settings().ollama_base_url


def _openai_client():
    try:
        import openai
        return openai.OpenAI(api_key="ollama", base_url=f"{_base_url()}/v1")
    except ImportError as exc:
        raise HTTPException(503, "openai SDK is not installed") from exc


def _safe_raise(exc: Exception) -> None:
    try:
        import openai
    except ImportError:
        raise HTTPException(503, "openai SDK is not installed") from exc

    if isinstance(exc, (openai.APIConnectionError, openai.APITimeoutError)):
        raise HTTPException(503, "Ollama is not available") from exc
    if isinstance(exc, openai.NotFoundError):
        raise HTTPException(400, "Model not available from provider") from exc
    if isinstance(exc, openai.BadRequestError):
        raise HTTPException(400, "Invalid request to provider") from exc
    log.error("Unexpected Ollama error: %s", type(exc).__name__)
    raise HTTPException(502, "Provider returned an unexpected error") from exc


class OllamaProvider(LLMProvider):
    def validate_credentials(self, api_key: str | None) -> None:
        """Validate by checking Ollama is reachable (no key needed)."""
        try:
            import httpx
            r = httpx.get(f"{_base_url()}/api/tags", timeout=5)
            if r.status_code != 200:
                raise HTTPException(503, "Ollama is not available")
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(503, "Ollama is not available") from exc

    def list_models(self, api_key: str | None) -> list[dict]:
        """Return locally installed Ollama models via /api/tags."""
        try:
            import httpx
            r = httpx.get(f"{_base_url()}/api/tags", timeout=5)
            if r.status_code != 200:
                raise HTTPException(503, "Ollama is not available")
            data = r.json()
            return [
                {"model_key": m["name"], "display_name": m["name"], "is_local": True}
                for m in data.get("models", [])
            ]
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(503, "Ollama is not available") from exc

    def generate(self, messages: list[dict], api_key: str | None, model_key: str) -> str:
        try:
            resp = _openai_client().chat.completions.create(
                model=model_key, messages=messages
            )
            return resp.choices[0].message.content or ""
        except HTTPException:
            raise
        except Exception as exc:
            _safe_raise(exc)
            return ""

    def stream(self, messages: list[dict], api_key: str | None, model_key: str) -> Iterator[str]:
        try:
            with _openai_client().chat.completions.create(
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
