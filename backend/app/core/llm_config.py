"""Request-scoped LLM credentials (BYOK)."""

from __future__ import annotations

from contextvars import ContextVar, Token
from dataclasses import dataclass
from typing import Literal, Optional

LlmProvider = Literal["openrouter", "openai", "anthropic"]

_llm_config_var: ContextVar[Optional["LlmConfig"]] = ContextVar("llm_config", default=None)


@dataclass(frozen=True)
class LlmConfig:
    provider: LlmProvider
    api_key: str
    model: str


def set_llm_config(config: Optional[LlmConfig]) -> Token:
    return _llm_config_var.set(config)


def reset_llm_config(token: Token) -> None:
    _llm_config_var.reset(token)


def get_llm_config() -> Optional[LlmConfig]:
    return _llm_config_var.get()


def parse_provider(value: Optional[str]) -> Optional[LlmProvider]:
    if not value:
        return None
    normalized = value.strip().lower()
    if normalized in ("openrouter", "openai", "anthropic", "claude"):
        return "anthropic" if normalized == "claude" else normalized  # type: ignore[return-value]
    return None


def config_from_headers(
    provider: Optional[str],
    api_key: Optional[str],
    model: Optional[str],
) -> Optional[LlmConfig]:
    parsed = parse_provider(provider)
    if not parsed or not api_key or not api_key.strip() or not model or not model.strip():
        return None
    return LlmConfig(provider=parsed, api_key=api_key.strip(), model=model.strip())
