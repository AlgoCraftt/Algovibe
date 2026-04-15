"""
LLM Client for code generation - Supports OpenRouter and direct Anthropic
"""

import asyncio
import logging
from typing import Optional, Any

# Conditional imports
try:
    from anthropic import Anthropic
except ImportError:
    Anthropic = None

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

from app.core.config import settings

logger = logging.getLogger(__name__)


class LLMClient:
    """Unified client for LLM APIs (OpenRouter or Anthropic)"""

    def __init__(
        self,
        api_key: str = None,
        model: str = None,
        timeout: float = 300.0,
    ):
        self.timeout = timeout
        
        # Determine provider
        if settings.openrouter_api_key:
            self.provider = "openrouter"
            self.api_key = api_key or settings.openrouter_api_key
            self.model = model or settings.openrouter_model
            self._client = None # Will be initialized as OpenAI client
            logger.info(f"[LLM] Using OpenRouter provider with model {self.model}")
        else:
            self.provider = "anthropic"
            self.api_key = api_key or settings.anthropic_api_key
            self.model = model or settings.claude_model
            self._client = None # Will be initialized as Anthropic client
            logger.info(f"[LLM] Using direct Anthropic provider with model {self.model}")

    def _get_client(self) -> Any:
        """Get or create the appropriate client"""
        if self._client is not None:
            return self._client

        if self.provider == "openrouter":
            if OpenAI is None:
                raise ImportError("openai package not installed. Run 'pip install openai'")
            self._client = OpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=self.api_key,
                timeout=self.timeout,
                max_retries=2,
                default_headers={
                    "HTTP-Referer": "https://algocraft.ai",
                    "X-Title": "AlgoCraft",
                }
            )
        else:
            if Anthropic is None:
                raise ImportError("anthropic package not installed. Run 'pip install anthropic'")
            self._client = Anthropic(
                api_key=self.api_key,
                timeout=self.timeout,
                max_retries=2,
            )
        return self._client

    async def generate(
        self,
        prompt: str,
        system: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        stream: bool = False,
    ) -> str:
        """Generate text completion"""
        if self.provider == "openrouter":
            return await self._generate_openrouter(prompt, system, temperature, max_tokens)
        else:
            return await self._generate_anthropic(prompt, system, temperature, max_tokens)

    async def _generate_openrouter(self, prompt, system, temperature, max_tokens):
        client = self._get_client()
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
            )
        )
        return response.choices[0].message.content

    async def _generate_anthropic(self, prompt, system, temperature, max_tokens):
        client = self._get_client()
        kwargs = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if system:
            kwargs["system"] = system

        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: client.messages.create(**kwargs),
        )
        
        text_parts = []
        for block in response.content:
            if hasattr(block, 'text'):
                text_parts.append(block.text)
        return "".join(text_parts)


# Global instance
_llm_client: Optional[LLMClient] = None

def get_llm_client() -> LLMClient:
    global _llm_client
    if _llm_client is None:
        _llm_client = LLMClient()
    return _llm_client

async def generate_completion(
    user_prompt: str,
    system_prompt: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 8192,
) -> str:
    client = get_llm_client()
    return await client.generate(
        prompt=user_prompt,
        system=system_prompt,
        temperature=temperature,
        max_tokens=max_tokens,
    )
