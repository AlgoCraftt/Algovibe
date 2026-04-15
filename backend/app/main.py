"""AlgoCraft Backend - Main FastAPI Application"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes import generate
from app.api.routes import protocols
from app.api.routes import publish

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Pre-warm models and resources at startup."""
    # Pre-load embedding model to avoid cold-start latency on first request
    try:
        from app.rag.embeddings import get_embeddings_client
        #get_embeddings_client()
        logger.info("[STARTUP] Embedding model pre-loaded (SKIPPED)")
    except Exception as e:
        logger.warning(f"[STARTUP] Failed to pre-load embedding model: {e}")

    yield


# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    description="AlgoCraft backend for generating, deploying, and publishing Algorand DApps",
    version=settings.app_version,
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(generate.router, prefix="/api/v1", tags=["generate"])
app.include_router(protocols.router, prefix="/api/v1", tags=["protocols"])
app.include_router(publish.router, prefix="/api/v1", tags=["publish"])


@app.get("/")
async def root():
    """Return basic service metadata."""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "healthy",
    }


@app.get("/health")
async def health():
    """Return backend readiness details for the active Algorand environment."""
    return {
        "status": "healthy",
        "app": settings.app_name,
        "version": settings.app_version,
        "llm": "claude",
        "model": settings.claude_model,
        "algorand_network": settings.default_network,
        "algorand_testnet_url": settings.algorand_testnet_url,
    }
