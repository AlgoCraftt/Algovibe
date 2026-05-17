"""
DApp path verifier — maze-style reachability checks for Algorand generated dApps.

Validates contract structure, ARC-32 ↔ useContract ↔ App.tsx wiring,
and opt-in / pay-method patterns before the user hits the preview.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field, asdict
from typing import Any, Optional

PathStatus = str  # ok | blocked | warning | skipped

LIFECYCLE_METHODS = {
    "createApplication",
    "optInToApplication",
    "closeOutOfApplication",
    "updateApplication",
    "deleteApplication",
    "create_application",
    "opt_in",
    "opt_in_to_application",
    "optIn",
    "close_out",
    "close_out_of_application",
    "update_application",
    "delete_application",
}

OPT_IN_UI_METHODS = {"__optIn__", "opt_in", "optIn", "opt_in_to_application", "optInToApplication"}

HOOK_RESERVED = {"readState", "loading", "error", "success", "refresh", "onWalletReady"}


def snake_to_camel(name: str) -> str:
    parts = name.split("_")
    if not parts:
        return name
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


def is_pay_type(t: str) -> bool:
    return str(t).lower() in ("pay", "payment")


@dataclass
class PathStep:
    id: str
    label: str
    status: PathStatus
    message: str
    file: Optional[str] = None
    fix_hint: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class PathReport:
    steps: list[PathStep] = field(default_factory=list)
    blockages: list[PathStep] = field(default_factory=list)
    warnings: list[PathStep] = field(default_factory=list)
    abi_methods: list[str] = field(default_factory=list)
    hook_exports: list[str] = field(default_factory=list)
    ui_calls: list[dict] = field(default_factory=list)

    @property
    def open_paths(self) -> int:
        return sum(1 for s in self.steps if s.status == "ok")

    @property
    def total_paths(self) -> int:
        return len(self.steps)

    @property
    def has_critical_blockages(self) -> bool:
        return len(self.blockages) > 0

    def to_dict(self) -> dict:
        return {
            "open_paths": self.open_paths,
            "total_paths": self.total_paths,
            "score": round(self.open_paths / max(1, self.total_paths), 2),
            "steps": [s.to_dict() for s in self.steps],
            "blockages": [s.to_dict() for s in self.blockages],
            "warnings": [s.to_dict() for s in self.warnings],
            "abi_methods": self.abi_methods,
            "hook_exports": self.hook_exports,
            "ui_calls": self.ui_calls,
        }


def _get_file(files: dict[str, str], *names: str) -> tuple[Optional[str], Optional[str]]:
    for n in names:
        for key, content in files.items():
            norm = key.replace("\\", "/")
            if norm.endswith(n) or norm == n or norm.endswith(f"/{n}"):
                return key, content
    return None, None


def extract_arc32_methods(arc32_spec: Optional[dict]) -> list[dict]:
    if not arc32_spec:
        return []
    methods = arc32_spec.get("contract", {}).get("methods", [])
    if not methods:
        methods = arc32_spec.get("methods", []) or []
    return [m for m in methods if m.get("name")]


def parse_use_contract_exports(code: str) -> set[str]:
    exports: set[str] = set(HOOK_RESERVED)
    for m in re.finditer(r"^\s+(\w+)\s*:\s*async\s*\(", code, re.MULTILINE):
        exports.add(m.group(1))
    return exports


def parse_use_contract_abi_methods(code: str) -> set[str]:
    methods: set[str] = set()
    for m in re.finditer(r"method:\s*['\"]([^'\"]+)['\"]", code):
        methods.add(m.group(1))
    return methods


def parse_app_id_from_hook(code: str) -> Optional[str]:
    m = re.search(r"export\s+const\s+APP_ID\s*=\s*(\d+)", code)
    return m.group(1) if m else None


def parse_use_contract_destructure(app_code: str) -> set[str]:
    names: set[str] = set()
    m = re.search(r"useContract\s*\(\s*\)\s*", app_code)
    if not m:
        return names
    # const { a, b, c } = useContract()
    dm = re.search(
        r"const\s*\{([^}]+)\}\s*=\s*useContract\s*\(",
        app_code,
        re.DOTALL,
    )
    if dm:
        for part in dm.group(1).split(","):
            part = part.strip()
            if not part:
                continue
            name = part.split(":")[0].strip()
            if name:
                names.add(name)
    return names


def parse_call_method_invocations(app_code: str) -> list[dict]:
    calls: list[dict] = []
    for m in re.finditer(
        r"callMethod\s*\(\s*\{([^}]+)\}\s*\)",
        app_code,
        re.DOTALL,
    ):
        block = m.group(1)
        method_m = re.search(r"method:\s*['\"]([^'\"]+)['\"]", block)
        if method_m:
            calls.append({"type": "callMethod", "method": method_m.group(1), "raw": block[:120]})
    return calls


def parse_hook_method_calls(app_code: str, hook_names: set[str]) -> list[dict]:
    calls: list[dict] = []
    for name in hook_names:
        if name in HOOK_RESERVED:
            continue
        for m in re.finditer(rf"\b{re.escape(name)}\s*\(", app_code):
            calls.append({"type": "useContract", "method": name, "camel": name})
    return calls


def spec_has_local_state(spec: dict) -> bool:
    local = spec.get("local_state") or spec.get("localState") or []
    if isinstance(local, list) and len(local) > 0:
        return True
    for m in spec.get("methods", []) or []:
        if m.get("local_state") or m.get("localState"):
            return True
    schema = spec.get("schema") or {}
    local_schema = schema.get("local") or {}
    if local_schema.get("declared"):
        return True
    return False


def contract_has_lifecycle_optin(contract_code: str) -> bool:
    return "optInToApplication" in contract_code


def contract_bad_optin_on_business_methods(contract_code: str) -> bool:
    if "optInToApplication" not in contract_code:
        return False
    return bool(
        re.search(
            r"@abimethod\s*\(\s*\{[^}]*allowActions\s*:\s*['\"]OptIn['\"]",
            contract_code,
        )
    )


def verify_dapp_paths(
    files: dict[str, str],
    spec: dict,
    arc32_spec: Optional[dict],
    contract_code: str = "",
    app_id: Optional[int] = None,
) -> PathReport:
    """Run full path / wiring verification. Returns report with blockages."""
    report = PathReport()
    spec = spec or {}

    # --- ARC-32 presence ---
    if not arc32_spec:
        step = PathStep(
            id="arc32",
            label="ARC-32 spec",
            status="blocked",
            message="Missing ARC-32 application spec",
            fix_hint="Recompile contract before generating UI",
        )
        report.steps.append(step)
        report.blockages.append(step)
        return report

    step = PathStep(
        id="arc32",
        label="ARC-32 spec",
        status="ok",
        message="ARC-32 spec present",
    )
    report.steps.append(step)

    abi_raw = extract_arc32_methods(arc32_spec)
    abi_business = [m for m in abi_raw if m.get("name") not in LIFECYCLE_METHODS]
    report.abi_methods = [m["name"] for m in abi_business]
    abi_names = {m["name"] for m in abi_raw}
    abi_camel = {snake_to_camel(m["name"]): m["name"] for m in abi_business}

    # --- Contract structure ---
    if spec_has_local_state(spec):
        if contract_code and not contract_has_lifecycle_optin(contract_code):
            st = PathStep(
                id="contract_optin_lifecycle",
                label="Contract opt-in lifecycle",
                status="blocked",
                message="Spec has local state but contract missing optInToApplication()",
                file="contract",
                fix_hint="Add public optInToApplication(): void lifecycle method (no @abimethod)",
            )
            report.steps.append(st)
            report.blockages.append(st)
        else:
            report.steps.append(
                PathStep(
                    id="contract_optin_lifecycle",
                    label="Contract opt-in lifecycle",
                    status="ok",
                    message="Lifecycle opt-in pattern present",
                )
            )

        if contract_code and contract_bad_optin_on_business_methods(contract_code):
            st = PathStep(
                id="contract_optin_abi",
                label="Contract ABI opt-in",
                status="blocked",
                message="Business methods use allowActions: OptIn while optInToApplication exists",
                file="contract",
                fix_hint="Use plain @abimethod() on vote/transfer; separate optInToApplication()",
            )
            report.steps.append(st)
            report.blockages.append(st)
    else:
        report.steps.append(
            PathStep(
                id="contract_local_state",
                label="Local state",
                status="skipped",
                message="No local state required",
            )
        )

    # --- useContract.ts ---
    hook_path, hook_code = _get_file(files, "useContract.ts", "/hooks/useContract.ts")
    if not hook_code:
        st = PathStep(
            id="hook_file",
            label="useContract hook",
            status="blocked",
            message="Missing hooks/useContract.ts",
        )
        report.steps.append(st)
        report.blockages.append(st)
        return report

    report.hook_exports = sorted(parse_use_contract_exports(hook_code) - HOOK_RESERVED)
    hook_abi_calls = parse_use_contract_abi_methods(hook_code)

    expected_app = str(app_id) if app_id else None
    found_app = parse_app_id_from_hook(hook_code)
    if expected_app and found_app and expected_app != found_app:
        st = PathStep(
            id="app_id",
            label="APP_ID constant",
            status="blocked",
            message=f"APP_ID={found_app} but deployed app is {expected_app}",
            file=hook_path,
            fix_hint=f"Set export const APP_ID = {expected_app}",
        )
        report.steps.append(st)
        report.blockages.append(st)
    else:
        report.steps.append(
            PathStep(
                id="app_id",
                label="APP_ID constant",
                status="ok",
                message=f"APP_ID={found_app or expected_app or '?'}",
                file=hook_path,
            )
        )

    for m in abi_business:
        name = m["name"]
        camel = snake_to_camel(name)
        if camel not in report.hook_exports and name not in hook_abi_calls:
            st = PathStep(
                id=f"hook_export_{name}",
                label=f"Hook exports {camel}",
                status="blocked",
                message=f"ARC-32 method '{name}' not exported from useContract as {camel}",
                file=hook_path,
                fix_hint=f"Add {camel} calling callMethod({{ method: '{name}', ... }})",
            )
            report.steps.append(st)
            report.blockages.append(st)
        else:
            report.steps.append(
                PathStep(
                    id=f"hook_export_{name}",
                    label=f"Hook exports {camel}",
                    status="ok",
                    message=f"{camel} → ABI '{name}'",
                    file=hook_path,
                )
            )

        if name not in hook_abi_calls:
            st = PathStep(
                id=f"hook_abi_{name}",
                label=f"Hook ABI wire {name}",
                status="warning",
                message=f"useContract may not call ABI method '{name}' internally",
                file=hook_path,
            )
            report.steps.append(st)
            report.warnings.append(st)

    # --- App.tsx ---
    app_path, app_code = _get_file(files, "App.tsx", "/App.tsx")
    if not app_code:
        st = PathStep(
            id="app_file",
            label="App.tsx",
            status="blocked",
            message="Missing App.tsx",
        )
        report.steps.append(st)
        report.blockages.append(st)
        return report

    hook_destructured = parse_use_contract_destructure(app_code)
    call_method_calls = parse_call_method_invocations(app_code)
    hook_calls = parse_hook_method_calls(app_code, parse_use_contract_exports(hook_code or ""))

    report.ui_calls = call_method_calls + hook_calls

    # Opt-in UI path
    if spec_has_local_state(spec):
        has_optin_ui = (
            "__optIn__" in app_code
            or "handleOptIn" in app_code
            or any(c.get("method") in OPT_IN_UI_METHODS for c in call_method_calls)
        )
        has_opted_gate = "__opted_in__" in app_code or "hasOptedIn" in app_code

        if not has_optin_ui:
            st = PathStep(
                id="ui_optin",
                label="UI opt-in flow",
                status="blocked",
                message="Local state required but App.tsx missing __optIn__ via callMethod",
                file=app_path,
                fix_hint="Add handleOptIn calling callMethod({ method: '__optIn__', args: [], app_id: APP_ID })",
            )
            report.steps.append(st)
            report.blockages.append(st)
        else:
            report.steps.append(
                PathStep(
                    id="ui_optin",
                    label="UI opt-in flow",
                    status="ok",
                    message="Opt-in path wired (__optIn__ / handleOptIn)",
                    file=app_path,
                )
            )

        if not has_opted_gate:
            st = PathStep(
                id="ui_opted_gate",
                label="Opt-in state gate",
                status="warning",
                message="Missing hasOptedIn / __opted_in__ gating after readState",
                file=app_path,
            )
            report.steps.append(st)
            report.warnings.append(st)

        bad_hook_optin = {"opt_in", "optIn", "optInToApplication"} & hook_destructured
        if bad_hook_optin:
            st = PathStep(
                id="ui_optin_wrong_hook",
                label="Opt-in via useContract",
                status="blocked",
                message=f"Do not call {bad_hook_optin} from useContract — use __optIn__ on useAlgorand",
                file=app_path,
            )
            report.steps.append(st)
            report.blockages.append(st)
    else:
        report.steps.append(
            PathStep(
                id="ui_optin",
                label="UI opt-in flow",
                status="skipped",
                message="No local state — opt-in path not required",
            )
        )

    # Each callMethod targets valid ABI or opt-in
    for call in call_method_calls:
        method = call["method"]
        if method in OPT_IN_UI_METHODS:
            report.steps.append(
                PathStep(
                    id=f"call_{method}",
                    label=f"Call {method}",
                    status="ok",
                    message="Routes to OptIn transaction in bridge",
                )
            )
            continue
        if method not in abi_names:
            st = PathStep(
                id=f"call_{method}",
                label=f"Call {method}",
                status="blocked",
                message=f"callMethod uses '{method}' but it is not in ARC-32 ABI",
                file=app_path,
                fix_hint=f"Use ABI name from: {', '.join(sorted(abi_names)[:8])}",
            )
            report.steps.append(st)
            report.blockages.append(st)
        else:
            report.steps.append(
                PathStep(
                    id=f"call_{method}",
                    label=f"Call {method}",
                    status="ok",
                    message=f"ABI method '{method}' exists",
                    file=app_path,
                )
            )

    # useContract() method calls
    hook_exports_set = parse_use_contract_exports(hook_code or "")
    for call in hook_calls:
        camel = call["method"]
        if camel not in hook_exports_set:
            snake_guess = None
            for abi_c, abi_n in abi_camel.items():
                if abi_c == camel:
                    snake_guess = abi_n
                    break
            st = PathStep(
                id=f"ui_{camel}",
                label=f"Button → {camel}()",
                status="blocked",
                message=f"App calls {camel}() but useContract does not export it",
                file=app_path,
                fix_hint=f"Export {camel} in useContract.ts"
                + (f" (ABI: {snake_guess})" if snake_guess else ""),
            )
            report.steps.append(st)
            report.blockages.append(st)
        else:
            abi_name = abi_camel.get(camel, camel)
            report.steps.append(
                PathStep(
                    id=f"ui_{camel}",
                    label=f"Button → {camel}()",
                    status="ok",
                    message=f"Wired to useContract.{camel} → '{abi_name}'",
                    file=app_path,
                )
            )

    # Pay methods: App should not pass payment object as ABI arg
    for m in abi_business:
        pay_args = [a for a in m.get("args", []) if is_pay_type(a.get("type", ""))]
        if not pay_args:
            continue
        name = m["name"]
        camel = snake_to_camel(name)
        if re.search(rf"{camel}\s*\(\s*\{{[^}}]*payment", app_code):
            st = PathStep(
                id=f"pay_{name}",
                label=f"Pay method {camel}",
                status="blocked",
                message=f"{camel}() must use microAlgo amount param, not payment object",
                file=app_path,
            )
            report.steps.append(st)
            report.blockages.append(st)

    # Global state read on mount
    if "readState" in app_code and "useEffect" in app_code:
        report.steps.append(
            PathStep(
                id="ui_read_on_mount",
                label="Load global state",
                status="ok",
                message="readState used in App",
                file=app_path,
            )
        )
    else:
        report.steps.append(
            PathStep(
                id="ui_read_on_mount",
                label="Load global state",
                status="warning",
                message="Consider readState() on mount for global stats",
                file=app_path,
            )
        )

    return report
