"""
Testnet transaction simulation for deployed Algorand apps (post-deploy / finalize).

Uses a funded simulator account (env) to build, sign, and simulate happy-path
transactions without broadcasting — catches runtime failures static wiring misses.
"""

from __future__ import annotations

import base64
import logging
from dataclasses import dataclass, field, asdict
from typing import Any, Optional

from algosdk import account, mnemonic, encoding
from algosdk.abi import ABIType, Method
from algosdk.error import AlgodHTTPError
from algosdk.transaction import (
    ApplicationCallTxn,
    ApplicationOptInTxn,
    OnComplete,
    PaymentTxn,
    SuggestedParams,
)
from algosdk.v2client import algod

from app.core.config import settings
from app.services.dapp_path_verifier import (
    LIFECYCLE_METHODS,
    extract_arc32_methods,
    is_pay_type,
    spec_has_local_state,
)

logger = logging.getLogger(__name__)

OPT_IN_ABI_NAMES = {
    "optInToApplication",
    "opt_in_to_application",
    "optIn",
    "opt_in",
}

DEFAULT_PAY_MICROALGOS = 100_000


@dataclass
class SimulationStep:
    id: str
    label: str
    status: str  # ok | failed | skipped | warning
    message: str
    method: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class SimulationReport:
    steps: list[SimulationStep] = field(default_factory=list)
    enabled: bool = False
    skipped_reason: Optional[str] = None

    @property
    def passed(self) -> int:
        return sum(1 for s in self.steps if s.status == "ok")

    @property
    def total(self) -> int:
        return sum(1 for s in self.steps if s.status in ("ok", "failed"))

    @property
    def has_failures(self) -> bool:
        return any(s.status == "failed" for s in self.steps)

    def to_dict(self) -> dict:
        return {
            "enabled": self.enabled,
            "skipped_reason": self.skipped_reason,
            "passed": self.passed,
            "total": self.total,
            "score": round(self.passed / max(1, self.total), 2) if self.total else 1.0,
            "steps": [s.to_dict() for s in self.steps],
        }


def _get_algod_client() -> algod.AlgodClient:
    url = (
        settings.algorand_testnet_url
        if settings.default_network == "testnet"
        else settings.algorand_mainnet_url
    )
    return algod.AlgodClient("", url)


def _load_simulator_account() -> Optional[tuple[str, str]]:
    phrase = (settings.algorand_simulator_mnemonic or "").strip()
    if not phrase:
        return None
    try:
        private_key = mnemonic.to_private_key(phrase)
        address = account.address_from_private_key(private_key)
        return address, private_key
    except Exception as e:
        logger.warning("[SIMULATOR] Invalid simulator mnemonic: %s", e)
        return None


def _arc32_hint_key(method_def: dict) -> str:
    args_sig = ",".join(a.get("type", "") for a in method_def.get("args", []))
    ret = method_def.get("returns", {}) or {}
    ret_sig = ret.get("type", "void") if isinstance(ret, dict) else "void"
    return f"{method_def['name']}({args_sig}){ret_sig}"


def _get_on_complete(method_name: str, arc32_spec: dict) -> OnComplete:
    methods = extract_arc32_methods(arc32_spec)
    method_def = next((m for m in methods if m.get("name") == method_name), None)
    if not method_def:
        return OnComplete.NoOpOC

    hints = arc32_spec.get("hints") or {}
    hint = hints.get(_arc32_hint_key(method_def)) or {}
    call_config = hint.get("call_config") or {}
    if call_config.get("opt_in") == "CALL":
        return OnComplete.OptInOC
    return OnComplete.NoOpOC


def _abi_method_from_arc32(m: dict) -> Method:
    arg_types = [ABIType.from_string(a.get("type", "uint64")) for a in m.get("args", [])]
    ret = m.get("returns") or {}
    ret_type = ret.get("type", "void") if isinstance(ret, dict) else "void"
    return Method(
        name=m["name"],
        args=arg_types,
        returns=ABIType.from_string(ret_type),
    )


def _synthetic_arg(arg_type: str, sender: str) -> Any:
    t = str(arg_type).lower()
    if t in ("uint64",) or t.startswith("uint"):
        return 1
    if t == "bool":
        return True
    if t in ("address", "account"):
        return sender
    if t == "string":
        return "sim"
    if t in ("bytes",) or t.startswith("byte"):
        return b"sim"
    if is_pay_type(t):
        return DEFAULT_PAY_MICROALGOS
    return 1


def _encode_abi_args(method: Method, raw_args: list[Any]) -> list[bytes]:
    app_args: list[bytes] = [method.get_selector()]
    for i, arg in enumerate(raw_args):
        at = method.args[i]
        t = str(at)
        if "uint" in t:
            app_args.append(encoding.encode_uint64(int(arg)))
        elif t == "bool":
            app_args.append(encoding.encode_uint64(1 if arg else 0))
        elif t in ("address", "account"):
            try:
                app_args.append(encoding.decode_address(str(arg)))
            except Exception:
                app_args.append(str(arg).encode("utf-8"))
        elif t == "string":
            encoded = str(arg).encode("utf-8")
            app_args.append(len(encoded).to_bytes(2, "big") + encoded)
        else:
            if isinstance(arg, bytes):
                app_args.append(arg)
            else:
                app_args.append(str(arg).encode("utf-8"))
    return app_args


def _is_opted_in(client: algod.AlgodClient, address: str, app_id: int) -> bool:
    try:
        info = client.account_info(address)
        for app in info.get("apps-local-state", []) or []:
            if int(app.get("id", -1)) == app_id:
                return True
    except AlgodHTTPError:
        pass
    return False


def _find_optin_method(methods: list[dict]) -> Optional[dict]:
    for m in methods:
        if m.get("name") in OPT_IN_ABI_NAMES:
            return m
    return None


def _simulate_signed_group(
    client: algod.AlgodClient,
    signed_txns: list[bytes],
) -> tuple[bool, str]:
    """Return (success, message) from algod simulate."""
    if not signed_txns:
        return True, "No transactions"

    try:
        from algosdk.v2client.models import SimulateRequest, SimulateTransactionGroup

        encoded = [base64.b64encode(st).decode("utf-8") for st in signed_txns]
        request = SimulateRequest(
            txn_groups=[SimulateTransactionGroup(txns=encoded)],
            allow_empty_signatures=False,
            allow_more_logs=True,
        )
        response = client.simulate_transactions(request)
    except ImportError:
        # Older SDK — dry-run via algod.dryrun
        try:
            dr = client.dryrun(
                {
                    "txns": [base64.b64encode(st).decode("utf-8") for st in signed_txns],
                    "accounts": [],
                    "apps": [],
                }
            )
            for txn in dr.get("txns", []):
                if txn.get("app-call-messages") or txn.get("logic-error"):
                    err = txn.get("logic-error") or txn.get("app-call-messages")
                    return False, str(err)[:500]
            return True, "Dry-run succeeded"
        except Exception as e:
            return False, f"Simulate unavailable: {e}"
    except AlgodHTTPError as e:
        return False, str(e)[:500]
    except Exception as e:
        return False, str(e)[:500]

    def _get(obj, *keys, default=None):
        if obj is None:
            return default
        if isinstance(obj, dict):
            for k in keys:
                if k in obj:
                    return obj[k]
            return default
        for k in keys:
            attr = k.replace("-", "_")
            if hasattr(obj, attr):
                return getattr(obj, attr)
        return default

    groups = _get(response, "txn-groups", "txn_groups") or []
    if not groups:
        return True, "Simulated (empty response)"

    g0 = groups[0]
    results = _get(g0, "txn-results", "txn_results") or []
    for idx, tr in enumerate(results):
        txn_result = _get(tr, "txn-result", "txn_result") or {}
        rejected = _get(tr, "rejected", default=False) or _get(txn_result, "rejected", default=False)
        if rejected:
            msg = (
                _get(tr, "failure-message", "failure_message")
                or _get(txn_result, "logic-error", "logic_error")
                or "rejected"
            )
            return False, f"Txn {idx}: {msg}"

    return True, "Simulated successfully"


def _sign_txn(txn, private_key: str) -> bytes:
    return txn.sign(private_key)


def simulate_dapp_on_testnet(
    app_id: int,
    arc32_spec: dict,
    spec: Optional[dict] = None,
) -> SimulationReport:
    """
    Run happy-path simulate on testnet for a deployed application.
  Requires ALGORAND_SIMULATOR_MNEMONIC (funded) and SIMULATE_ENABLED=true.
    """
    report = SimulationReport()

    if not settings.simulate_enabled:
        report.skipped_reason = "Simulation disabled (SIMULATE_ENABLED=false)"
        return report

    if not app_id or app_id <= 0:
        report.skipped_reason = "No deployed App ID"
        return report

    acct = _load_simulator_account()
    if not acct:
        report.skipped_reason = "Set ALGORAND_SIMULATOR_MNEMONIC (funded testnet account) in .env"
        return report

    sender, private_key = acct
    spec = spec or {}
    report.enabled = True

    try:
        client = _get_algod_client()
    except Exception as e:
        report.skipped_reason = f"Algod client error: {e}"
        report.enabled = False
        return report

    # App exists on chain
    try:
        client.application_info(app_id)
        report.steps.append(
            SimulationStep(
                id="app_on_chain",
                label="App on testnet",
                status="ok",
                message=f"Application {app_id} found",
            )
        )
    except AlgodHTTPError as e:
        report.steps.append(
            SimulationStep(
                id="app_on_chain",
                label="App on testnet",
                status="failed",
                message=str(e)[:300],
            )
        )
        return report

    methods = extract_arc32_methods(arc32_spec)
    contract_name = (
        arc32_spec.get("contract", {}).get("name")
        or arc32_spec.get("name")
        or "Contract"
    )
    business = [m for m in methods if m.get("name") not in LIFECYCLE_METHODS]

    try:
        sp_dict = client.suggested_params()
        sp = SuggestedParams(
            fee=sp_dict["fee"],
            first=sp_dict["first"],
            last=sp_dict["last"],
            gh=sp_dict["genesis-hash"],
            gen=sp_dict["genesis-id"],
        )
    except Exception as e:
        report.skipped_reason = f"Could not fetch txn params: {e}"
        report.enabled = False
        return report

    needs_local = spec_has_local_state(spec)
    opted_in = _is_opted_in(client, sender, app_id)

    # Opt-in step
    if needs_local and not opted_in:
        optin_def = _find_optin_method(methods)
        app_args = None
        if optin_def:
            try:
                m = _abi_method_from_arc32(optin_def)
                app_args = [m.get_selector()]
            except Exception:
                app_args = None

        optin_txn = ApplicationOptInTxn(
            sender=sender,
            sp=sp,
            index=app_id,
            app_args=app_args,
        )
        signed = [_sign_txn(optin_txn, private_key)]
        ok, msg = _simulate_signed_group(client, signed)
        report.steps.append(
            SimulationStep(
                id="sim_optin",
                label="Simulate opt-in",
                status="ok" if ok else "failed",
                message=msg,
                method="__optIn__",
            )
        )
        if ok:
            opted_in = True
    elif needs_local:
        report.steps.append(
            SimulationStep(
                id="sim_optin",
                label="Simulate opt-in",
                status="skipped",
                message="Simulator already opted in",
                method="__optIn__",
            )
        )

    # ABI method calls
    for mdef in business:
        name = mdef.get("name", "")
        if not name or name in OPT_IN_ABI_NAMES:
            continue

        abi_args = [a for a in mdef.get("args", []) if not is_pay_type(a.get("type", ""))]
        pay_args = [a for a in mdef.get("args", []) if is_pay_type(a.get("type", ""))]

        try:
            method = _abi_method_from_arc32(mdef)
        except Exception as e:
            report.steps.append(
                SimulationStep(
                    id=f"sim_{name}",
                    label=f"Simulate {name}",
                    status="failed",
                    message=f"ABI parse error: {e}",
                    method=name,
                )
            )
            continue

        raw = [_synthetic_arg(a.get("type", "uint64"), sender) for a in abi_args]
        app_args = _encode_abi_args(method, raw)

        on_complete = _get_on_complete(name, arc32_spec)
        if on_complete == OnComplete.OptInOC and opted_in:
            on_complete = OnComplete.NoOpOC

        app_txn = ApplicationCallTxn(
            sender=sender,
            sp=sp,
            index=app_id,
            on_complete=on_complete,
            app_args=app_args,
        )

        txns = [app_txn]
        if pay_args:
            pay_amount = DEFAULT_PAY_MICROALGOS
            pay_txn = PaymentTxn(
                sender=sender,
                sp=sp,
                receiver=encoding.get_application_address(app_id),
                amt=pay_amount,
            )
            txns = [pay_txn, app_txn]

        if len(txns) > 1:
            from algosdk.transaction import assign_group_id

            assign_group_id(txns)

        signed = [_sign_txn(t, private_key) for t in txns]
        ok, msg = _simulate_signed_group(client, signed)
        report.steps.append(
            SimulationStep(
                id=f"sim_{name}",
                label=f"Simulate {name}",
                status="ok" if ok else "failed",
                message=msg,
                method=name,
            )
        )

    if not business:
        report.steps.append(
            SimulationStep(
                id="sim_methods",
                label="ABI methods",
                status="skipped",
                message="No callable ABI methods in ARC-32",
            )
        )

    return report
