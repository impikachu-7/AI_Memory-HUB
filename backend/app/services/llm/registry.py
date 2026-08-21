"""Provider factory — maps provider names to their LLMProvider implementation."""
from fastapi import HTTPException
from app.services.llm.base import LLMProvider


def get_provider(name: str) -> LLMProvider:
    """Return an LLMProvider instance for the given provider name.

    Raises HTTPException(400) for unknown providers.
    Imports are deferred so unused SDK packages are never loaded.
    """
    # Deferred imports keep unused SDKs from being loaded at startup
    if name == "openai":
        from app.services.llm.openai_provider import OpenAIProvider
        return OpenAIProvider()
    if name == "gemini":
        from app.services.llm.gemini_provider import GeminiProvider
        return GeminiProvider()
    if name == "anthropic":
        from app.services.llm.anthropic_provider import AnthropicProvider
        return AnthropicProvider()
    if name == "deepseek":
        from app.services.llm.deepseek_provider import DeepSeekProvider
        return DeepSeekProvider()
    if name == "groq":
        from app.services.llm.groq_provider import GroqProvider
        return GroqProvider()
    if name == "openrouter":
        from app.services.llm.openrouter_provider import OpenRouterProvider
        return OpenRouterProvider()
    if name == "ollama":
        from app.services.llm.ollama_provider import OllamaProvider
        return OllamaProvider()
    raise HTTPException(400, f"Unknown provider: {name}")
