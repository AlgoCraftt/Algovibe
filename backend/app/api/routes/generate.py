"""Generate endpoint - Main Algorand DApp generation pipeline"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional
import json
import asyncio

from app.agents.orchestrator import run_pipeline, run_pipeline_finalize
from app.agents.react_agent import fix_frontend_files, ReactGenerationError
from app.api.deps import llm_request_context, read_llm_headers
from app.core.llm import InvalidApiKeyError
from app.core.llm_config import LlmConfig

router = APIRouter()


class GenerateRequest(BaseModel):
    """Request body for /generate endpoint"""

    prompt: str
    framework: str = Field(default="puyats", description="Target Algorand framework (puyapy, puyats, tealscript)")
    network: str = Field(default="testnet", description="Target Algorand network (testnet or mainnet)")
    user_wallet: Optional[str] = Field(default=None, description="Optional Algorand address for ownership-aware flows")


class GenerateResponse(BaseModel):
    """Final response after generation complete"""

    status: str
    app_id: Optional[int] = None
    contract_id: Optional[str] = Field(default=None, description="Legacy alias for app_id")
    files: Optional[dict] = None
    error: Optional[str] = None


def _normalize_event_fields(event: dict) -> dict:
    """Normalize event fields for compatibility."""
    normalized = dict(event)
    app_id = normalized.get("app_id") or normalized.get("package_id") or normalized.get("contract_id")
    if app_id:
        normalized["app_id"] = app_id
        normalized.setdefault("contract_id", str(app_id))
    return normalized


def _error_sse(message: str, *, error_code: Optional[str] = None) -> str:
    payload: dict = {"step": "error", "message": message, "status": "failed"}
    if error_code:
        payload["error_code"] = error_code
    return f"data: {json.dumps(payload)}\n\n"


async def event_generator(
    prompt: str,
    framework: str,
    network: str,
    user_wallet: Optional[str],
    llm_config: Optional[LlmConfig],
):
    """Generate SSE events as pipeline progresses"""
    with llm_request_context(llm_config):
        try:
            async for event in run_pipeline(prompt, framework, network, user_wallet):
                event = _normalize_event_fields(event)
                yield f"data: {json.dumps(event)}\n\n"
                await asyncio.sleep(0.1)
        except InvalidApiKeyError:
            yield _error_sse("Invalid API key. Check AI Settings and try again.", error_code="invalid_api_key")
        except ValueError as e:
            yield _error_sse(str(e))
        except Exception as e:
            yield _error_sse(str(e))


async def finalize_event_generator(
    build_id: str,
    package_id: str,
    llm_config: Optional[LlmConfig],
):
    """Generate SSE events for the finalize (post-deployment) pipeline."""
    with llm_request_context(llm_config):
        try:
            app_id = int(package_id)
            async for event in run_pipeline_finalize(build_id, app_id):
                event = _normalize_event_fields(event)
                yield f"data: {json.dumps(event)}\n\n"
                await asyncio.sleep(0.1)
        except InvalidApiKeyError:
            yield _error_sse("Invalid API key. Check AI Settings and try again.", error_code="invalid_api_key")
        except Exception as e:
            yield _error_sse(str(e))


class FinalizeRequest(BaseModel):
    build_id: str
    package_id: str


class FixFrontendRequest(BaseModel):
    """Patch existing preview frontend without recompiling the contract."""

    prompt: str
    files: dict
    preview_error: Optional[str] = None
    app_id: Optional[str] = None


async def fix_frontend_event_generator(
    prompt: str,
    files: dict,
    preview_error: Optional[str],
    app_id: Optional[str],
    llm_config: Optional[LlmConfig],
):
    """SSE stream for lightweight frontend-only fixes."""
    with llm_request_context(llm_config):
        try:
            yield f"data: {json.dumps({'step': 'fixing_frontend', 'message': 'Updating preview code...'})}\n\n"
            await asyncio.sleep(0.05)
            patched = await fix_frontend_files(
                files=files,
                user_prompt=prompt,
                preview_error=preview_error,
                app_id=app_id,
            )
            yield f"data: {json.dumps({'step': 'complete', 'message': 'Preview updated.', 'files': patched})}\n\n"
        except InvalidApiKeyError:
            yield _error_sse("Invalid API key. Check AI Settings and try again.", error_code="invalid_api_key")
        except ReactGenerationError as e:
            yield f"data: {json.dumps({'step': 'error', 'error': str(e), 'message': str(e)})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'step': 'error', 'error': str(e), 'message': str(e)})}\n\n"


@router.post("/finalize")
async def finalize_dapp(
    request: FinalizeRequest,
    llm_config: Optional[LlmConfig] = Depends(read_llm_headers),
):
    """Resume pipeline after user-signed deployment."""
    if not request.build_id or not request.package_id:
        raise HTTPException(status_code=400, detail="build_id and package_id are required")

    return StreamingResponse(
        finalize_event_generator(request.build_id, request.package_id, llm_config),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/fix-frontend")
async def fix_frontend(
    request: FixFrontendRequest,
    llm_config: Optional[LlmConfig] = Depends(read_llm_headers),
):
    """Apply a chat follow-up to existing frontend files only (no contract pipeline)."""
    if not request.prompt.strip():
        raise HTTPException(status_code=400, detail="prompt cannot be empty")
    if not request.files:
        raise HTTPException(status_code=400, detail="files cannot be empty")

    return StreamingResponse(
        fix_frontend_event_generator(
            request.prompt.strip(),
            request.files,
            request.preview_error,
            request.app_id,
            llm_config,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/generate")
async def generate_dapp(
    request: GenerateRequest,
    llm_config: Optional[LlmConfig] = Depends(read_llm_headers),
):
    """Generate an Algorand DApp from natural language prompt."""
    if not request.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    return StreamingResponse(
        event_generator(
            request.prompt,
            request.framework,
            request.network,
            request.user_wallet,
            llm_config,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
