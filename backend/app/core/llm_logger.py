"""
LLM Call Logger — logs every prompt sent to the LLM and every response received.

Logs are saved to backend/llm_logs/ as JSON files with timestamps.
Each file contains: provider, model, system prompt, user prompt, response, duration, tokens.

Usage:
    from app.core.llm_logger import log_llm_call
    log_llm_call(provider, model, system, prompt, response, duration_ms)

View logs:
    ls backend/llm_logs/
    cat backend/llm_logs/2026-06-08_12-30-45_architect.json
"""

import json
import os
import time
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

# Log directory (relative to backend/)
LOG_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'llm_logs')


def _ensure_log_dir():
    os.makedirs(LOG_DIR, exist_ok=True)


def log_llm_call(
    *,
    provider: str,
    model: str,
    system_prompt: Optional[str],
    user_prompt: str,
    response: str,
    duration_ms: float,
    caller: str = "unknown",
    error: Optional[str] = None,
    extra: Optional[dict] = None,
) -> str:
    """
    Log an LLM call to a JSON file.
    
    Returns the log file path.
    """
    _ensure_log_dir()

    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    # Use caller name for easy identification (e.g. "architect", "algorand_agent", "react_agent")
    filename = f"{timestamp}_{caller}.json"
    filepath = os.path.join(LOG_DIR, filename)

    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "caller": caller,
        "provider": provider,
        "model": model,
        "duration_ms": round(duration_ms, 1),
        "system_prompt": system_prompt[:2000] + "..." if system_prompt and len(system_prompt) > 2000 else system_prompt,
        "system_prompt_length": len(system_prompt) if system_prompt else 0,
        "user_prompt": user_prompt[:5000] + "..." if len(user_prompt) > 5000 else user_prompt,
        "user_prompt_length": len(user_prompt),
        "response": response[:10000] + "..." if len(response) > 10000 else response,
        "response_length": len(response),
        "error": error,
        **(extra or {}),
    }

    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(log_entry, f, indent=2, ensure_ascii=False)
        logger.debug(f"[LLM_LOG] Saved: {filename} ({duration_ms:.0f}ms, {len(response)} chars)")
    except Exception as e:
        logger.warning(f"[LLM_LOG] Failed to save log: {e}")

    return filepath


def get_recent_logs(n: int = 10) -> list:
    """Get the N most recent log entries (for debugging)."""
    _ensure_log_dir()
    files = sorted(
        [f for f in os.listdir(LOG_DIR) if f.endswith('.json')],
        reverse=True,
    )[:n]
    logs = []
    for f in files:
        try:
            with open(os.path.join(LOG_DIR, f), 'r', encoding='utf-8') as fp:
                logs.append(json.load(fp))
        except Exception:
            continue
    return logs
