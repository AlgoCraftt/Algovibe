"""
Algorand Compiler Client

Calls external compiler API to compile Algorand smart contracts.
Replaces the local Move compilation with HTTP API calls.
"""

import base64
import json
import httpx
import logging
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class CompilerResult:
    success: bool
    approval_teal: Optional[str] = None
    clear_teal: Optional[str] = None
    arc32_spec: Optional[Dict[str, Any]] = None
    logs: List[str] = field(default_factory=list)
    error: Optional[str] = None


class CompilerClient:
    """HTTP client for external Unified Algorand compiler API."""

    def __init__(self):
        self.base_url = settings.compiler_server_url
        self.timeout = 60  # seconds

    async def compile(self, framework: str, code: str, filename: str = "contract") -> CompilerResult:
        """Compile contract code for the specified framework."""
        if not self.base_url:
            logger.error("COMPILER_SERVER_URL is not configured")
            return CompilerResult(
                success=False, logs=[], error="Compiler server URL not configured"
            )

        endpoint_map = {
            "puyapy": "/compile-puyapy",
            "puyats": "/compile-puyats",
            "tealscript": "/compile-tealscript",
        }

        endpoint = endpoint_map.get(framework)
        if not endpoint:
            return CompilerResult(
                success=False, logs=[], error=f"Unknown framework: {framework}"
            )

        # Build request body
        code_b64 = base64.b64encode(code.encode()).decode()
        
        # Consistent body format based on common error message: Expected { code } or { codeBase64 }
        if framework == "tealscript":
             body = {"code": code} # TealScript doc says 'code' is string
        else:
             body = {"codeBase64": code_b64}
        
        # DO NOT add filename - the server's validation is extremely strict and will fail if extra fields are present.

        logger.info(f"[COMPILER] Sending request to {endpoint} with payload keys: {list(body.keys())}")

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url.rstrip('/')}{endpoint}",
                    json=body,
                )
                
                if response.status_code != 200:
                    logger.error(f"Compiler API error ({response.status_code}): {response.text}")
                    return CompilerResult(
                        success=False, 
                        logs=[], 
                        error=f"Compiler server returned {response.status_code}: {response.text}"
                    )
                
                data = response.json()

            if not data.get("ok", False):
                return CompilerResult(
                    success=False,
                    logs=data.get("logs", []),
                    error=data.get("error", "Unknown compilation error")
                )

            # Success! Extract files
            files = data.get("files", {})
            approval_teal = None
            clear_teal = None
            arc32_spec = None
            
            # Helper to decode base64 file data
            def get_decoded(file_data):
                if isinstance(file_data, dict):
                    if file_data.get("encoding") == "base64":
                        data_str = str(file_data.get("data", "")).strip()
                        return base64.b64decode(data_str).decode()
                    return str(file_data.get("data", ""))
                
                # If it's a raw string, it might still be base64 (common in recent runs)
                if isinstance(file_data, str):
                    clean_data = file_data.strip().replace("\n", "").replace("\r", "")
                    try:
                        # Only try to decode if it looks like base64 
                        # (TEAL starts with '#pragma' if decoded, or 'I3By' / 'I3By' if base64)
                        if clean_data.startswith("I3By") or len(clean_data) > 64: 
                            return base64.b64decode(clean_data).decode()
                    except Exception as e:
                        logger.debug(f"String was not base64 or failed decode: {e}")
                    return file_data
                return str(file_data)

            logger.info(f"[COMPILER] Received files: {list(files.keys())}")
            for fname, fcontent in files.items():
                lowered_fname = fname.lower()
                # Matching patterns for PuyaPy & PuyaTS (handles both exact and prefixed names)
                if ".approval.teal" in lowered_fname or lowered_fname == "approval.teal":
                    approval_teal = get_decoded(fcontent)
                elif ".clear.teal" in lowered_fname or lowered_fname == "clear.teal":
                    clear_teal = get_decoded(fcontent)
                elif ".arc32.json" in lowered_fname or lowered_fname == "arc32.json":
                    try:
                        spec_str = get_decoded(fcontent)
                        arc32_spec = json.loads(spec_str)
                    except Exception as e:
                        logger.warning(f"Failed to parse ARC32 spec from {fname}: {e}")

            # Fallback: Extract TEAL from ARC32 spec if missing separate files
            if arc32_spec and not approval_teal:
                source = arc32_spec.get("source", {})
                approval_teal = source.get("approval")
                clear_teal = source.get("clear")
                
                # ARC32 spec source is ALWAYS base64 in the official JSON output
                def force_decode(val):
                    if not val: return val
                    try:
                        # If it starts with #pragma, it's already decoded
                        if val.strip().startswith("#pragma"):
                             return val
                        return base64.b64decode(val.strip()).decode()
                    except:
                        return val
                
                approval_teal = force_decode(approval_teal)
                clear_teal = force_decode(clear_teal)
            
            return CompilerResult(
                success=bool(approval_teal or arc32_spec),
                approval_teal=approval_teal,
                clear_teal=clear_teal,
                arc32_spec=arc32_spec,
                logs=data.get("logs", []),
                error=None if (approval_teal or arc32_spec) else "No TEAL or ARC32 spec found in compiler output"
            )

        except Exception as e:
            logger.error(f"Compiler API exception: {e}")
            return CompilerResult(
                success=False, logs=[], error=f"Compiler request failed: {str(e)}"
            )
