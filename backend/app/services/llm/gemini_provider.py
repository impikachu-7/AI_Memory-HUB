"""Google Gemini provider — uses google-generativeai SDK."""
import logging
from collections.abc import Iterator
from fastapi import HTTPException

from app.services.llm.base import LLMProvider

log = logging.getLogger(__name__)


def _configure(api_key: str):
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        return genai
    except ImportError as exc:
        raise HTTPException(503, "google-generativeai SDK is not installed") from exc


def _safe_raise(exc: Exception) -> None:
    name = type(exc).__name__
    msg = str(exc)
    if "API_KEY_INVALID" in msg or "PERMISSION_DENIED" in msg or "invalid" in msg.lower() and "key" in msg.lower():
        raise HTTPException(401, "Provider authentication failed") from exc
    if "RESOURCE_EXHAUSTED" in msg or "quota" in msg.lower() or "rate" in msg.lower():
        raise HTTPException(429, "Provider rate limit reached") from exc
    if "NOT_FOUND" in msg or "not found" in msg.lower():
        raise HTTPException(400, "Model not available from provider") from exc
    if "UNAVAILABLE" in msg or "ServiceUnavailable" in name:
        raise HTTPException(503, "Provider temporarily unavailable") from exc
    log.error("Unexpected Gemini error: %s", name)
    raise HTTPException(502, "Provider returned an unexpected error") from exc


class GeminiProvider(LLMProvider):
    def validate_credentials(self, api_key: str | None) -> None:
        if not api_key:
            raise HTTPException(401, "Provider authentication failed")
        try:
            genai = _configure(api_key)
            list(genai.list_models())
        except HTTPException:
            raise
        except Exception as exc:
            _safe_raise(exc)

    def list_models(self, api_key: str | None) -> list[dict]:
        if not api_key:
            raise HTTPException(401, "Provider authentication failed")
        try:
            genai = _configure(api_key)
            return [
                {"model_key": m.name, "display_name": m.display_name or m.name, "is_local": False}
                for m in genai.list_models()
                if "generateContent" in (m.supported_generation_methods or [])
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
            genai = _configure(api_key)
            # Convert OpenAI-style messages to Gemini format
            contents = _to_gemini_contents(messages)
            system_instruction = _extract_system(messages)
            model = genai.GenerativeModel(model_key, system_instruction=system_instruction)
            response = model.generate_content(contents)
            return response.text or ""
        except HTTPException:
            raise
        except Exception as exc:
            _safe_raise(exc)
            return ""

    def stream(self, messages: list[dict], api_key: str | None, model_key: str) -> Iterator[str]:
        if not api_key:
            raise HTTPException(401, "Provider authentication failed")
        try:
            genai = _configure(api_key)
            contents = _to_gemini_contents(messages)
            system_instruction = _extract_system(messages)
            model = genai.GenerativeModel(model_key, system_instruction=system_instruction)
            for chunk in model.generate_content(contents, stream=True):
                if chunk.text:
                    yield chunk.text
        except HTTPException:
            raise
        except Exception as exc:
            _safe_raise(exc)


def _extract_system(messages: list[dict]) -> str | None:
    for m in messages:
        if m.get("role") == "system":
            return m.get("content")
    return None


def _to_gemini_contents(messages: list[dict]) -> list[dict]:
    """Convert OpenAI-style messages to Gemini content format, skipping system messages."""
    role_map = {"user": "user", "assistant": "model"}
    return [
        {"role": role_map.get(m["role"], "user"), "parts": [{"text": m["content"]}]}
        for m in messages
        if m.get("role") in role_map and m.get("content")
    ]
