"""Shared FastAPI dependencies."""

from contextlib import contextmanager
from typing import Generator, Optional

from fastapi import Header

from app.core.llm_config import LlmConfig, config_from_headers, reset_llm_config, set_llm_config


def read_llm_headers(
    x_llm_provider: Optional[str] = Header(None, alias="X-LLM-Provider"),
    x_llm_api_key: Optional[str] = Header(None, alias="X-LLM-Api-Key"),
    x_llm_model: Optional[str] = Header(None, alias="X-LLM-Model"),
) -> Optional[LlmConfig]:
    return config_from_headers(x_llm_provider, x_llm_api_key, x_llm_model)


@contextmanager
def llm_request_context(config: Optional[LlmConfig]) -> Generator[None, None, None]:
    token = set_llm_config(config)
    try:
        yield
    finally:
        reset_llm_config(token)
