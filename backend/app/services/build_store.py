"""
File-based store for pending build states awaiting user wallet signature.

Saves pipeline state between the compile step (which emits sign_required)
and the finalize step (which generates the React frontend after the user
has signed and submitted the deploy transaction). Survives Uvicorn reloads.
"""

import time
import json
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Store sessions in a local JSON file
STORE_FILE = Path(__file__).resolve().parent.parent.parent / "build_sessions.json"
_TTL = 3600  # 1 hour


def _load_all() -> dict:
    if not STORE_FILE.exists():
        return {}
    try:
        with open(STORE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load build store: {e}")
        return {}


def _save_all(data: dict) -> None:
    try:
        with open(STORE_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to save build store: {e}")


def save_build(build_id: str, state: dict) -> None:
    """Persist pipeline state keyed by build_id."""
    data = _load_all()
    # Ensure events and other complex objects are JSON serializable
    serializable_state = {
        **state,
        "_saved_at": time.time()
    }
    data[build_id] = serializable_state
    _save_all(data)


def load_build(build_id: str) -> Optional[dict]:
    """Return saved state, or None if expired / not found."""
    data = _load_all()
    entry = data.get(build_id)
    if not entry:
        return None
    
    if time.time() - entry.get("_saved_at", 0) > _TTL:
        delete_build(build_id)
        return None
    return entry


def delete_build(build_id: str) -> None:
    data = _load_all()
    if build_id in data:
        del data[build_id]
        _save_all(data)
