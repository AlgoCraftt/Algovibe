"""
Verify → deterministic fix → LLM repair loop for generated Algorand dApps.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional

from app.agents.react_agent import (
    ReactGenerationError,
    _apply_deterministic_fixes,
    _normalize_path,
    fix_frontend_files,
)
from app.core.llm import InvalidApiKeyError
from app.services.dapp_path_verifier import (
    PathReport,
    PathStep,
    snake_to_camel,
    verify_dapp_paths,
    extract_arc32_methods,
    LIFECYCLE_METHODS,
)

logger = logging.getLogger(__name__)

MAX_REPAIR_ROUNDS = 3

INTEGRATION_FIX_PROMPT = """You are an Algorand DApp integration engineer. Fix WIRING ONLY — do not redesign the UI.

Output ONLY valid JSON (no markdown):
{"files": {"/App.tsx": "full content", "/hooks/useContract.ts": "full content if changed"}}

MANDATORY RULES:
- APP_ID must match the deployed app id given in the user message.
- useContract exports camelCase methods matching ARC-32 ABI snake_case names.
- If local_state exists: opt-in MUST use useAlgorand().callMethod({ method: '__optIn__', args: [], app_id: APP_ID }).
- NEVER call opt_in/optIn from useContract destructuring.
- Gate actions on hasOptedIn / readState().__opted_in__ when local state required.
- Pay methods: pass microAlgo number, never payment txn as ABI arg.
- Preserve visual styling; only fix broken paths listed in BLOCKAGES."""


def _normalize_files(files: dict[str, str]) -> dict[str, str]:
    out: dict[str, str] = {}
    for k, v in files.items():
        out[_normalize_path(k)] = v
    return out


def apply_deterministic_wiring_fixes(
    files: dict[str, str],
    spec: dict,
    arc32_spec: Optional[dict],
    app_id: Optional[int],
) -> dict[str, str]:
    """Regex-based fixes before LLM repair."""
    files = _normalize_files(_apply_deterministic_fixes(files))
    app_key = "/App.tsx"
    hook_key = "/hooks/useContract.ts"
    app_code = files.get(app_key, "")
    hook_code = files.get(hook_key, "")

    if app_id is not None and hook_code:
        hook_code = re.sub(
            r"export\s+const\s+APP_ID\s*=\s*\d+",
            f"export const APP_ID = {app_id}",
            hook_code,
            count=1,
        )
        files[hook_key] = hook_code

    if not arc32_spec or not app_code:
        return files

    abi_methods = [
        m
        for m in extract_arc32_methods(arc32_spec)
        if m.get("name") not in LIFECYCLE_METHODS
    ]
    camel_to_abi = {snake_to_camel(m["name"]): m["name"] for m in abi_methods}
    abi_to_camel = {m["name"]: snake_to_camel(m["name"]) for m in abi_methods}

    # Fix snake_case hook calls in App → camelCase
    for abi_name, camel in abi_to_camel.items():
        app_code = re.sub(
            rf"\b{re.escape(abi_name)}\s*\(",
            f"{camel}(",
            app_code,
        )
        app_code = re.sub(
            rf"await\s+{re.escape(abi_name)}\s*\(",
            f"await {camel}(",
            app_code,
        )

    # Fix callMethod with wrong casing
    for camel, abi_name in camel_to_abi.items():
        app_code = re.sub(
            rf"method:\s*['\"]{re.escape(camel)}['\"]",
            f"method: '{abi_name}'",
            app_code,
        )

    # Remove invalid useContract opt_in destructuring names
    dm = re.search(r"const\s*\{([^}]+)\}\s*=\s*useContract\s*\(", app_code, re.DOTALL)
    if dm:
        parts = []
        for part in dm.group(1).split(","):
            name = part.strip().split(":")[0].strip()
            if name in ("opt_in", "optIn", "optInToApplication", "opt_in_to_application"):
                continue
            parts.append(part.strip())
        if parts:
            new_destructure = "const { " + ", ".join(parts) + " } = useContract("
            app_code = re.sub(
                r"const\s*\{[^}]+\}\s*=\s*useContract\s*\(",
                new_destructure,
                app_code,
                count=1,
            )

    files[app_key] = app_code
    return files


def _blockages_summary(report: PathReport) -> str:
    lines = []
    for b in report.blockages:
        lines.append(f"- [{b.id}] {b.message}" + (f" → {b.fix_hint}" if b.fix_hint else ""))
    return "\n".join(lines) if lines else "None"


async def verify_and_repair_dapp(
    files: dict[str, str],
    spec: dict,
    arc32_spec: Optional[dict],
    contract_code: str = "",
    app_id: Optional[int] = None,
) -> tuple[dict[str, str], PathReport]:
    """
    Run path verification; apply deterministic + LLM fixes until clear or max rounds.
    """
    files = _normalize_files(files)
    report = verify_dapp_paths(files, spec, arc32_spec, contract_code, app_id)

    for round_idx in range(MAX_REPAIR_ROUNDS):
        if not report.has_critical_blockages:
            logger.info("[PATH_REPAIR] All critical paths open after round %s", round_idx)
            break

        logger.info(
            "[PATH_REPAIR] Round %s: %s blockages",
            round_idx + 1,
            len(report.blockages),
        )
        files = apply_deterministic_wiring_fixes(files, spec, arc32_spec, app_id)
        report = verify_dapp_paths(files, spec, arc32_spec, contract_code, app_id)
        if not report.has_critical_blockages:
            break

        blockage_text = _blockages_summary(report)
        fix_prompt = (
            f"Fix all integration blockages for Algorand app ID {app_id}.\n\n"
            f"BLOCKAGES:\n{blockage_text}\n\n"
            f"CONTRACT SPEC:\n{json.dumps(spec, indent=2)[:3000]}\n\n"
            f"ARC-32 METHODS: {', '.join(report.abi_methods)}"
        )

        try:
            patched = await fix_frontend_files(
                files=files,
                user_prompt=fix_prompt,
                preview_error=f"Path verification failed:\n{blockage_text}",
                app_id=str(app_id) if app_id else None,
                system_prompt=INTEGRATION_FIX_PROMPT,
            )
            files = _normalize_files(patched)
        except InvalidApiKeyError:
            raise
        except ReactGenerationError as e:
            logger.warning("[PATH_REPAIR] LLM repair failed: %s", e)
            break
        except Exception as e:
            logger.warning("[PATH_REPAIR] Repair exception: %s", e)
            break

        report = verify_dapp_paths(files, spec, arc32_spec, contract_code, app_id)

    return files, report
