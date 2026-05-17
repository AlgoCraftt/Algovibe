"""LLM BYOK validation."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.llm import InvalidApiKeyError, LLMClient
from app.core.llm_config import LlmConfig, LlmProvider, parse_provider

router = APIRouter()


class ValidateLlmRequest(BaseModel):
    provider: str = Field(description="openrouter | openai | anthropic")
    api_key: str = Field(min_length=1)
    model: str = Field(min_length=1)


class ValidateLlmResponse(BaseModel):
    valid: bool = True
    provider: str
    model: str


@router.post("/llm/validate", response_model=ValidateLlmResponse)
async def validate_llm_credentials(request: ValidateLlmRequest):
    """Verify API key and model with a minimal completion."""
    provider = parse_provider(request.provider)
    if not provider:
        raise HTTPException(
            status_code=400,
            detail="Invalid provider. Use openrouter, openai, or anthropic.",
        )

    config = LlmConfig(
        provider=provider,
        api_key=request.api_key.strip(),
        model=request.model.strip(),
    )

    try:
        client = LLMClient(config)
        await client.validate()
    except InvalidApiKeyError:
        raise HTTPException(status_code=401, detail="Invalid API key")
    except Exception as e:
        msg = str(e).lower()
        if "model" in msg and ("not found" in msg or "does not exist" in msg or "invalid" in msg):
            raise HTTPException(status_code=400, detail=f"Invalid model: {request.model}")
        raise HTTPException(status_code=400, detail=str(e))

    return ValidateLlmResponse(valid=True, provider=provider, model=config.model)
