"""Generate endpoint - Main Algorand DApp generation pipeline"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional
import json
import asyncio

from app.agents.orchestrator import run_pipeline, run_pipeline_finalize

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
    # app_id is Algorand's identifier
    app_id = normalized.get("app_id") or normalized.get("package_id") or normalized.get("contract_id")
    if app_id:
        normalized["app_id"] = app_id
        normalized.setdefault("contract_id", str(app_id))
    return normalized


async def event_generator(prompt: str, framework: str, network: str, user_wallet: Optional[str]):
    """Generate SSE events as pipeline progresses"""
    try:
        async for event in run_pipeline(prompt, framework, network, user_wallet):
            event = _normalize_event_fields(event)
            event_data = json.dumps(event)
            yield f"data: {event_data}\n\n"
            await asyncio.sleep(0.1)
    except Exception as e:
        error_event = json.dumps({"step": "error", "message": str(e), "status": "failed"})
        yield f"data: {error_event}\n\n"


class FinalizeRequest(BaseModel):
    build_id: str
    package_id: str


async def finalize_event_generator(build_id: str, package_id: str):
    """Generate SSE events for the finalize (post-deployment) pipeline."""
    try:
        # Convert package_id string to Algorand app_id integer
        app_id = int(package_id)
        async for event in run_pipeline_finalize(build_id, app_id):
            event = _normalize_event_fields(event)
            yield f"data: {json.dumps(event)}\n\n"
            await asyncio.sleep(0.1)
    except Exception as e:
        error_event = json.dumps({"step": "error", "message": str(e), "status": "failed"})
        yield f"data: {error_event}\n\n"


@router.post("/finalize")
async def finalize_dapp(request: FinalizeRequest):
    """Resume pipeline after user-signed deployment."""
    if not request.build_id or not request.package_id:
        raise HTTPException(status_code=400, detail="build_id and package_id are required")

    return StreamingResponse(
        finalize_event_generator(request.build_id, request.package_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/generate")
async def generate_dapp(request: GenerateRequest):
    """Generate an Algorand DApp from natural language prompt."""
    if not request.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    return StreamingResponse(
        event_generator(request.prompt, request.framework, request.network, request.user_wallet),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
