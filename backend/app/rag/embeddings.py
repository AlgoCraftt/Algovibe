"""
Stub Embeddings Client (Vercel-friendly)

This version replaces the heavy LocalEmbeddings client with a lightweight stub
to keep the build size within Vercel's limits.
"""

import asyncio
from typing import Optional

class LocalEmbeddings:
    """Stub client for local embeddings (disabled on Vercel)"""

    def __init__(self, model_name: str = None):
        self.model_name = model_name or "disabled"

    async def embed(self, text: str) -> list[float]:
        """Return an empty vector (RAG will fall back to curated documentation)"""
        return []

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Return empty vectors for the batch"""
        return [[] for _ in texts]


# Global instance
_embeddings_client: Optional[LocalEmbeddings] = None


def get_embeddings_client() -> LocalEmbeddings:
    """Get global stub embeddings client"""
    global _embeddings_client
    if _embeddings_client is None:
        _embeddings_client = LocalEmbeddings()
    return _embeddings_client


async def get_embedding(text: str) -> list[float]:
    """Stub embedding function"""
    client = get_embeddings_client()
    return await client.embed(text)


async def get_embeddings(texts: list[str]) -> list[list[float]]:
    """Stub batch embedding function"""
    client = get_embeddings_client()
    return await client.embed_batch(texts)


async def check_embeddings_available() -> bool:
    """Always return False since local embeddings are disabled on Vercel"""
    return False
