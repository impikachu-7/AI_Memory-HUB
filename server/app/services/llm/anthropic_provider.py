"""Anthropic Claude provider — uses the official anthropic SDK.

Anthropic does not expose a public REST endpoint to list available models,
so list_models() returns a curated list of current Claude models.
This list is populated from https://docs.anthropic.com/en/docs/about-claude/models
and should be updated when new models are released.
"""
import logging
from collections.abc import Iterator
from fastapi import HTTPException

from app.services.llm.base import LLMProvider

log = logging.getLogger(__name__)

# Curated from Anthropic docs — current as of implementation date.
# model_key values are the exact API identifiers accepted by the Messages API.
_CLAUDE_MODELS = [
    {"model_key": "claude-opus-4-5", "display_name": "Claude Opus 4.5", "is_local": False},
    {"model_key": "claude-sonnet-4-5", "display_name": "Claude Sonnet 4.5", "is_local": False},
    {"model_key": "claude-haiku-3-5", "display_name": "Claude Haiku 3.5", "is_local": False},
    {"model_key": "claude-opus-4-0", "display_name": "Claude Opus 4", "is_local": False},
    {"model_key": "claude-sonnet-4-0", "display_name": "Claude Sonnet 4", "is_local": False},
]


def _client(api_key: str):
    try:
        import anthropic
        return anthropic.Anthropic(api_key=api_key)
    except ImportError as exc:
        raise HTTPException(503, "anthropic SDK is not installed") from exc


def _safe_raise(exc: Exception) -> None:
    try:
        import anthropic
    except ImportError:
        raise HTTPException(503, "anthropic SDK is not installed") from exc

    if isinstance(exc, anthropic.AuthenticationError):
        raise HTTPException(401, "Provider authentication failed") from exc
    if isinstance(exc, anthropic.RateLimitError):
        raise HTTPException(429, "Provider rate limit reached") from exc
    if isinstance(exc, anthropic.NotFoundError):
        raise HTTPException(400, "Model not available from provider") from exc
    if isinstance(exc, (anthropic.APIConnectionError, anthropic.APITimeoutError)):
        raise HTTPException(503, "Provider temporarily unavailable") from exc
    if isinstance(exc, anthropic.BadRequestError):
        raise HTTPException(400, "Invalid request to provider") from exc
    log.error("Unexpected Anthropic error: %s", type(exc).__name__)
    raise HTTPException(502, "Provider returned an unexpected error") from exc


def _build_anthropic_messages(messages: list[dict]) -> tuple[str | None, list[dict]]:
    """Split system message out; return (system_text, user/assistant messages)."""
    system = None
    out = []
    for m in messages:
        if m.get("role") == "system":
            system = m.get("content", "")
        elif m.get("role") in ("user", "assistant") and m.get("content"):
            out.append({"role": m["role"], "content": m["content"]})
    return system, out


class AnthropicProvider(LLMProvider):
    def validate_credentials(self, api_key: str | None) -> None:
        if not api_key:
            raise HTTPException(401, "Provider authentication failed")
        try:
            # Cheapest possible validation: count tokens on an empty string
            _client(api_key).messages.count_tokens(
                model="claude-haiku-3-5",
                messages=[{"role": "user", "content": "hi"}],
            )
        except HTTPException:
            raise
        except Exception as exc:
            _safe_raise(exc)

    def list_models(self, api_key: str | None) -> list[dict]:
        # Anthropic has no public list-models endpoint; return curated list.
        return list(_CLAUDE_MODELS)

    def generate(self, messages: list[dict], api_key: str | None, model_key: str) -> str:
        if not api_key:
            raise HTTPException(401, "Provider authentication failed")
        system, msgs = _build_anthropic_messages(messages)
        if not msgs:
            msgs = [{"role": "user", "content": "Hello"}]
        try:
            kwargs: dict = {"model": model_key, "max_tokens": 8096, "messages": msgs}
            if system:
                kwargs["system"] = system
            resp = _client(api_key).messages.create(**kwargs)
            return resp.content[0].text if resp.content else ""
        except HTTPException:
            raise
        except Exception as exc:
            _safe_raise(exc)
            return ""

    def stream(self, messages: list[dict], api_key: str | None, model_key: str) -> Iterator[str]:
        if not api_key:
            raise HTTPException(401, "Provider authentication failed")
        system, msgs = _build_anthropic_messages(messages)
        if not msgs:
            msgs = [{"role": "user", "content": "Hello"}]
        try:
            kwargs: dict = {"model": model_key, "max_tokens": 8096, "messages": msgs}
            if system:
                kwargs["system"] = system
            with _client(api_key).messages.stream(**kwargs) as stream:
                for text in stream.text_stream:
                    yield text
        except HTTPException:
            raise
        except Exception as exc:
            _safe_raise(exc)
