"""
Pipeline Run Logger — captures a complete build run as one JSON file.

Each run produces: backend/run_logs/<timestamp>_<template_type>.json

Contains:
  - user_prompt (what the user typed)
  - template_type + spec (what the architect decided)
  - capabilities (derived flags)
  - contract_code (each attempt)
  - compiler_results (each compile attempt — success/failure + error)
  - audit_report (security findings)
  - generated_files (final frontend file list)
  - timeline (timestamped events)
  - duration
"""

import json
import os
import time
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

LOG_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'run_logs')


def _ensure_dir():
    os.makedirs(LOG_DIR, exist_ok=True)


class RunLog:
    """Accumulates events during a pipeline run and writes to disk at the end."""

    def __init__(self, user_prompt: str, framework: str = "puyats"):
        _ensure_dir()
        self.start_time = time.time()
        self.data = {
            "user_prompt": user_prompt,
            "framework": framework,
            "started_at": datetime.now().isoformat(),
            "template_type": None,
            "spec": None,
            "capabilities": None,
            "contract_attempts": [],  # list of { code, compiler_result }
            "audit_report": None,
            "generated_files": None,  # dict of path → content (truncated)
            "timeline": [],  # list of { timestamp, event, detail }
            "error": None,
            "duration_s": None,
        }

    def event(self, event_name: str, detail: str = ""):
        """Add a timestamped event to the timeline."""
        elapsed = round(time.time() - self.start_time, 1)
        self.data["timeline"].append({
            "t": elapsed,
            "event": event_name,
            "detail": detail[:500],
        })

    def set_spec(self, template_type: str, spec: dict):
        self.data["template_type"] = template_type
        self.data["spec"] = spec
        self.data["capabilities"] = spec.get("capabilities")
        self.event("spec_ready", f"type={template_type}, methods={len(spec.get('methods', []))}")

    def add_contract_attempt(self, code: str, compile_success: bool, error: Optional[str] = None):
        attempt = {
            "attempt_number": len(self.data["contract_attempts"]) + 1,
            "code_length": len(code),
            "code_preview": code[:3000] + ("..." if len(code) > 3000 else ""),
            "compile_success": compile_success,
            "error": error[:500] if error else None,
        }
        self.data["contract_attempts"].append(attempt)
        status = "success" if compile_success else f"failed: {(error or '')[:100]}"
        self.event(f"compile_attempt_{attempt['attempt_number']}", status)

    def set_audit(self, report_dict: dict):
        self.data["audit_report"] = report_dict
        self.event("audit_complete", report_dict.get("summary", ""))

    def set_generated_files(self, files: dict):
        """Store file list with truncated content (full code is in LLM logs)."""
        truncated = {}
        for path, content in (files or {}).items():
            truncated[path] = {
                "lines": len(content.split('\n')),
                "chars": len(content),
                "preview": content[:500] + ("..." if len(content) > 500 else ""),
            }
        self.data["generated_files"] = truncated
        self.event("files_generated", f"{len(files)} files")

    def set_error(self, error: str):
        self.data["error"] = error
        self.event("error", error[:200])

    def save(self) -> str:
        """Finalize and write the run log. Returns file path."""
        self.data["duration_s"] = round(time.time() - self.start_time, 1)
        self.data["ended_at"] = datetime.now().isoformat()

        template = self.data.get("template_type") or "unknown"
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{timestamp}_{template}.json"
        filepath = os.path.join(LOG_DIR, filename)

        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(self.data, f, indent=2, ensure_ascii=False, default=str)
            logger.info(f"[RUN_LOG] Saved: {filename} ({self.data['duration_s']}s)")
        except Exception as e:
            logger.warning(f"[RUN_LOG] Failed to save: {e}")

        return filepath
