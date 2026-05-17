"""
LLM Client for code generation — OpenRouter, OpenAI, and Anthropic (BYOK).
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Optional

try:
    from anthropic import Anthropic
except ImportError:
    Anthropic = None

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

from app.core.config import settings
from app.core.llm_config import LlmConfig, get_llm_config

logger = logging.getLogger(__name__)


class InvalidApiKeyError(Exception):
    """Raised when the provider rejects the API key."""


def _is_auth_failure(exc: Exception) -> bool:
    msg = str(exc).lower()
    if any(
        token in msg
        for token in (
            "401",
            "403",
            "invalid api key",
            "incorrect api key",
            "authentication",
            "unauthorized",
            "invalid x-api-key",
            "permission denied",
        )
    ):
        return True
    status = getattr(exc, "status_code", None)
    if status in (401, 403):
        return True
    response = getattr(exc, "response", None)
    if response is not None and getattr(response, "status_code", None) in (401, 403):
        return True
    return False


class LLMClient:
    """Unified client for OpenRouter, OpenAI, or Anthropic."""

    def __init__(self, config: LlmConfig, timeout: float = 300.0):
        self.config = config
        self.provider = config.provider
        self.api_key = config.api_key
        self.model = config.model
        self.timeout = timeout
        self._client: Any = None
        logger.info(f"[LLM] provider={self.provider} model={self.model}")

    @classmethod
    def from_request_or_settings(cls) -> "LLMClient":
        cfg = get_llm_config()
        if cfg is not None:
            return cls(cfg)

        if settings.openrouter_api_key:
            return cls(
                LlmConfig(
                    provider="openrouter",
                    api_key=settings.openrouter_api_key,
                    model=settings.openrouter_model,
                )
            )
        if settings.anthropic_api_key:
            return cls(
                LlmConfig(
                    provider="anthropic",
                    api_key=settings.anthropic_api_key,
                    model=settings.claude_model,
                )
            )
        raise ValueError(
            "No LLM configured. Add your API key in AI Settings, or set "
            "OPENROUTER_API_KEY / ANTHROPIC_API_KEY on the server."
        )

    def _get_client(self) -> Any:
        if self._client is not None:
            return self._client

        if self.provider in ("openrouter", "openai"):
            if OpenAI is None:
                raise ImportError("openai package not installed. Run 'pip install openai'")
            kwargs: dict[str, Any] = {
                "api_key": self.api_key,
                "timeout": self.timeout,
                "max_retries": 0,
            }
            if self.provider == "openrouter":
                kwargs["base_url"] = "https://openrouter.ai/api/v1"
                kwargs["default_headers"] = {
                    "HTTP-Referer": "https://algocraft.ai",
                    "X-Title": "AlgoCraft",
                }
            self._client = OpenAI(**kwargs)
        else:
            if Anthropic is None:
                raise ImportError("anthropic package not installed. Run 'pip install anthropic'")
            self._client = Anthropic(
                api_key=self.api_key,
                timeout=self.timeout,
                max_retries=0,
            )
        return self._client

    async def validate(self) -> None:
        """Minimal completion to verify the API key and model."""
        try:
            await self.generate(
                prompt="Reply with exactly: OK",
                system="You are a connectivity check. Reply with OK only.",
                temperature=0,
                max_tokens=16,
            )
        except InvalidApiKeyError:
            raise
        except Exception as e:
            if _is_auth_failure(e):
                raise InvalidApiKeyError("Invalid API key") from e
            raise

    async def generate(
        self,
        prompt: str,
        system: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        stream: bool = False,
    ) -> str:
        try:
            if self.provider in ("openrouter", "openai"):
                return await self._generate_openai_compatible(prompt, system, temperature, max_tokens)
            return await self._generate_anthropic(prompt, system, temperature, max_tokens)
        except InvalidApiKeyError:
            raise
        except Exception as e:
            if _is_auth_failure(e):
                raise InvalidApiKeyError("Invalid API key") from e
            raise

    async def _generate_openai_compatible(
        self, prompt: str, system: Optional[str], temperature: float, max_tokens: int
    ) -> str:
        client = self._get_client()
        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        loop = asyncio.get_event_loop()

        def _call():
            return client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
            )

        response = await loop.run_in_executor(None, _call)
        content = response.choices[0].message.content
        return content or ""

    async def _generate_anthropic(
        self, prompt: str, system: Optional[str], temperature: float, max_tokens: int
    ) -> str:
        client = self._get_client()
        kwargs: dict[str, Any] = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if system:
            kwargs["system"] = system

        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(None, lambda: client.messages.create(**kwargs))

        text_parts: list[str] = []
        for block in response.content:
            if hasattr(block, "text"):
                text_parts.append(block.text)
        return "".join(text_parts)


def get_llm_client() -> LLMClient:
    return LLMClient.from_request_or_settings()


async def generate_completion(
    user_prompt: str,
    system_prompt: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 8192,
) -> str:
    client = get_llm_client()
    try:
        return await client.generate(
            prompt=user_prompt,
            system=system_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
        )
    except InvalidApiKeyError:
        raise
