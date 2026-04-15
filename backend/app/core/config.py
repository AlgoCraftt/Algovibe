"""Application configuration using Pydantic Settings"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from pathlib import Path

# Project root is three levels up from this file (backend/app/core/config.py)
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # App
    app_name: str = "AlgoCraft"
    app_version: str = "1.0.0"
    debug: bool = False

    # LLM Provider Configuration
    # We prefer OpenRouter if provided, otherwise fallback to direct Anthropic
    anthropic_api_key: str = ""
    claude_model: str = "claude-3-5-sonnet-20240620"
    
    openrouter_api_key: str = ""
    openrouter_model: str

    # Embeddings (sentence-transformers, local)
    embedding_model: str = "all-MiniLM-L6-v2"

    # RAG (ChromaDB)
    chroma_persist_dir: str = "./knowledge/chroma_db"
    rag_top_k: int = 5

    # Algorand
    compiler_server_url: str = ""
    algorand_testnet_url: str = "https://testnet-api.algonode.cloud"
    algorand_mainnet_url: str = "https://mainnet-api.algonode.cloud"
    algorand_indexer_testnet: str = "https://testnet-idx.algonode.cloud"
    algorand_indexer_mainnet: str = "https://mainnet-idx.algonode.cloud"
    default_network: str = "testnet"

    # Supported frameworks (PuyaPy + PuyaTs are primary; TealScript is legacy/migration only)
    supported_frameworks: list[str] = ["puyapy", "puyats", "tealscript"]

    # Database
    database_url: str = "postgresql://algocraft:algocraft@localhost:5432/algocraft"

    # Context7 (optional - for enhanced documentation retrieval)
    context7_api_key: str = ""

    # Vercel (one-click publish)
    vercel_api_token: str = ""
    vercel_team_id: str | None = None

    model_config = SettingsConfigDict(
        env_file=(str(_PROJECT_ROOT / ".env"), ".env"),
        env_file_encoding="utf-8",
        extra="ignore" # Ignore extra fields in .env
    )


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


settings = get_settings()
