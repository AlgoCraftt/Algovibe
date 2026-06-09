"""
Security Auditor Agent — audits generated Algorand contracts for security & logic flaws.

Runs AFTER successful compilation, BEFORE the user signs the deploy transaction.

Two layers:
  1. Deterministic checks (always run, milliseconds, no LLM) — pattern-based detection of
     missing access control, unrecoverable funds, integer underflow, unvalidated payments.
  2. LLM deep-review (only for risky/financial templates) — reasons about logic correctness,
     dead-ends, and exploit vectors.

The auditor produces an AuditReport with findings classified by severity:
  - critical: must fix before deploy (e.g. anyone can drain funds)
  - warning:  should review (e.g. funds may lock under edge case)
  - info:     advisory / best practice

Critical findings can trigger ONE regeneration pass with the findings injected as context.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field, asdict
from typing import Optional

from app.core.llm import generate_completion, InvalidApiKeyError

logger = logging.getLogger(__name__)


# Template types that warrant the full LLM deep-review (handle value / multi-party logic)
FINANCIAL_TEMPLATES = {
    "escrow", "crowdfunding", "token_vault", "marketplace", "lottery",
    "defi", "dao", "subscription", "x402_service", "token",
}

Severity = str  # critical | warning | info


@dataclass
class Finding:
    id: str
    severity: Severity
    title: str
    detail: str
    fix_hint: Optional[str] = None
    source: str = "deterministic"  # deterministic | llm

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class AuditReport:
    findings: list[Finding] = field(default_factory=list)
    checks_run: int = 0
    llm_reviewed: bool = False

    @property
    def critical(self) -> list[Finding]:
        return [f for f in self.findings if f.severity == "critical"]

    @property
    def warnings(self) -> list[Finding]:
        return [f for f in self.findings if f.severity == "warning"]

    @property
    def has_critical(self) -> bool:
        return len(self.critical) > 0

    @property
    def passed(self) -> bool:
        return not self.has_critical

    def summary(self) -> str:
        c = len(self.critical)
        w = len(self.warnings)
        if c == 0 and w == 0:
            return f"Security audit passed — {self.checks_run} checks, no issues"
        parts = []
        if c:
            parts.append(f"{c} critical")
        if w:
            parts.append(f"{w} warning{'s' if w != 1 else ''}")
        return f"Security audit: {', '.join(parts)} ({self.checks_run} checks)"

    def to_dict(self) -> dict:
        return {
            "passed": self.passed,
            "has_critical": self.has_critical,
            "checks_run": self.checks_run,
            "llm_reviewed": self.llm_reviewed,
            "critical_count": len(self.critical),
            "warning_count": len(self.warnings),
            "findings": [f.to_dict() for f in self.findings],
            "summary": self.summary(),
        }

    def findings_for_prompt(self) -> str:
        """Format critical + warning findings for injection into a regeneration prompt."""
        lines = []
        for f in self.critical + self.warnings:
            line = f"- [{f.severity.upper()}] {f.title}: {f.detail}"
            if f.fix_hint:
                line += f"\n  FIX: {f.fix_hint}"
            lines.append(line)
        return "\n".join(lines) if lines else "None"


# ─────────────────────────────────────────────────────────────────────────────
# Deterministic checks (PuyaTS-focused; safe no-ops for puyapy)
# ─────────────────────────────────────────────────────────────────────────────

# Lifecycle methods are not "business" methods — they don't need explicit access control
_LIFECYCLE = {
    "createApplication", "optInToApplication", "closeOutOfApplication",
    "updateApplication", "deleteApplication",
}

# Method-name hints that indicate a privileged / state-mutating action
_PRIVILEGED_HINTS = (
    "withdraw", "claim", "transfer", "mint", "burn", "set_", "update",
    "pause", "freeze", "admin", "owner", "close", "refund", "release",
    "distribute", "payout", "rescue", "sweep", "config",
)


def _extract_methods(contract_code: str) -> list[dict]:
    """Find @abimethod methods and their bodies in PuyaTS code (best-effort regex)."""
    methods = []
    # Match: @abimethod(...) [public] name(args) [: ret] {
    # Multi-line aware: decorator and signature may span lines, return type optional.
    pattern = re.compile(
        r"@abimethod\([^)]*\)\s*(?:public\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*([\w\[\]<>, ]+?))?\s*\{",
        re.MULTILINE | re.DOTALL,
    )
    for m in pattern.finditer(contract_code):
        name = m.group(1)
        args = m.group(2)
        ret = (m.group(3) or "void").strip()
        # Grab a rough body slice (from method start to next @abimethod or class close)
        start = m.end()
        next_method = contract_code.find("@abimethod", start)
        body_end = next_method if next_method != -1 else len(contract_code)
        body = contract_code[start:body_end]
        methods.append({"name": name, "args": args, "returns": ret, "body": body})
    return methods


def _check_access_control(methods: list[dict], contract_code: str) -> list[Finding]:
    findings: list[Finding] = []
    has_owner = "owner" in contract_code.lower()

    for meth in methods:
        name = meth["name"]
        if name in _LIFECYCLE:
            continue
        body = meth["body"]
        lname = name.lower()

        is_privileged = any(h in lname for h in _PRIVILEGED_HINTS)
        # Methods that send funds out are always privileged
        sends_funds = "itxn.payment" in body or "itxn.assetTransfer" in body or "itxn.assettransfer" in body.lower()

        if (is_privileged or sends_funds) and has_owner:
            # Does the body assert sender == owner (or similar)?
            has_sender_check = bool(
                re.search(r"assert\([^)]*Txn\.sender\s*===?\s*this\.\w*[Oo]wner", body)
                or re.search(r"assert\([^)]*owner[^)]*sender", body, re.IGNORECASE)
                or re.search(r"assert\([^)]*sender[^)]*owner", body, re.IGNORECASE)
            )
            if not has_sender_check:
                sev = "critical" if sends_funds else "warning"
                findings.append(Finding(
                    id=f"access_{name}",
                    severity=sev,
                    title=f"Method '{name}' may lack access control",
                    detail=(
                        f"'{name}' performs a privileged action"
                        + (" and sends funds out" if sends_funds else "")
                        + " but does not appear to assert the caller is the owner."
                    ),
                    fix_hint=f"Add: assert(Txn.sender === this.owner.value, 'Only owner') at the start of {name}.",
                ))
    return findings


def _check_integer_underflow(methods: list[dict]) -> list[Finding]:
    findings: list[Finding] = []
    for meth in methods:
        body = meth["body"]
        name = meth["name"]
        # Find subtractions on state values: this.x.value - something  OR  local - amount
        subtractions = re.findall(r"(\w[\w.()]*)\s*-\s*(\w[\w.()]*)", body)
        if not subtractions:
            continue
        # Is there a guard assert(... >= ...) before subtracting?
        has_guard = bool(re.search(r"assert\([^)]*>=", body))
        if subtractions and not has_guard:
            findings.append(Finding(
                id=f"underflow_{name}",
                severity="warning",
                title=f"Possible unchecked subtraction in '{name}'",
                detail=(
                    f"'{name}' subtracts values without an obvious 'assert(a >= b)' guard. "
                    "On the AVM, uint64 underflow panics — but a missing balance check can "
                    "still allow incorrect state if logic is wrong."
                ),
                fix_hint="Add assert(balance >= amount, 'Insufficient') before subtracting.",
            ))
    return findings


def _check_fund_recovery(contract_code: str, methods: list[dict]) -> list[Finding]:
    findings: list[Finding] = []
    # Does the contract receive funds? (verifies a payment or holds a balance)
    receives_funds = (
        "gtxn.PaymentTxn" in contract_code
        or "gtxn.AssetTransferTxn" in contract_code
        or "payment.amount" in contract_code
        or "currentApplicationAddress" in contract_code
    )
    # Is there any outbound path?
    has_outbound = "itxn.payment" in contract_code or "itxn.assetTransfer" in contract_code.replace("AssetTransfer", "assetTransfer")
    has_withdraw_method = any(
        h in m["name"].lower() for m in methods for h in ("withdraw", "claim", "refund", "release", "payout")
    )

    if receives_funds and not (has_outbound or has_withdraw_method):
        findings.append(Finding(
            id="locked_funds",
            severity="critical",
            title="Funds may be permanently locked",
            detail=(
                "The contract receives or holds funds but has no withdraw/claim/refund method "
                "and no outbound inner transaction. Deposited funds cannot be recovered."
            ),
            fix_hint="Add an owner-gated withdraw() method using itxn.payment({...}).submit().",
        ))
    return findings


def _check_payment_validation(contract_code: str) -> list[Finding]:
    findings: list[Finding] = []
    # If it reads a grouped payment, does it validate receiver AND amount?
    reads_payment = "gtxn.PaymentTxn" in contract_code or "gtxn.AssetTransferTxn" in contract_code
    if reads_payment:
        # Multi-line aware checks (re.DOTALL) — asserts often span several lines.
        # Receiver validation: an assert mentioning 'receiver' anywhere.
        validates_receiver = bool(
            re.search(r"assert\(.*?receiver.*?\)", contract_code, re.DOTALL | re.IGNORECASE)
        )
        # Amount validation: an assert with 'amount' AND a comparison (>=, >, ==) nearby.
        validates_amount = bool(
            re.search(r"assert\(.*?amount.*?(>=|>|===|==).*?\)", contract_code, re.DOTALL | re.IGNORECASE)
            or re.search(r"assert\(.*?(>=|>).*?amount.*?\)", contract_code, re.DOTALL | re.IGNORECASE)
            # Also accept the common pattern: paidAmount >= price
            or re.search(r"(amount|paid\w*)\s*(>=|>)\s*this\.\w*[Pp]rice", contract_code)
            or re.search(r"this\.\w*[Pp]rice\w*\.value\s*(<=|<)\s*\w*amount", contract_code, re.IGNORECASE)
        )
        if not validates_receiver:
            findings.append(Finding(
                id="payment_receiver",
                severity="critical",
                title="Grouped payment receiver not validated",
                detail=(
                    "The contract reads a payment from the transaction group but does not assert "
                    "the payment receiver. An attacker could group a payment to themselves."
                ),
                fix_hint="assert(payment.receiver === Global.currentApplicationAddress, '...').",
            ))
        if not validates_amount:
            findings.append(Finding(
                id="payment_amount",
                severity="warning",
                title="Grouped payment amount not validated",
                detail="The contract reads a payment but does not assert a minimum amount.",
                fix_hint="assert(payment.amount >= this.pricePerCall.value, '...').",
            ))
    return findings


def run_deterministic_checks(contract_code: str, framework: str) -> list[Finding]:
    """Run all deterministic security checks. PuyaTS-focused."""
    if framework != "puyats" or not contract_code:
        return []
    methods = _extract_methods(contract_code)
    findings: list[Finding] = []
    findings += _check_access_control(methods, contract_code)
    findings += _check_integer_underflow(methods)
    findings += _check_fund_recovery(contract_code, methods)
    findings += _check_payment_validation(contract_code)
    return findings


# ─────────────────────────────────────────────────────────────────────────────
# LLM deep review (risky templates only)
# ─────────────────────────────────────────────────────────────────────────────

AUDITOR_SYSTEM_PROMPT = """You are an adversarial security researcher attacking an Algorand PuyaTS (TypeScript) smart contract.
Your goal: find a concrete way to STEAL funds, LOCK funds permanently, or BYPASS the contract's intended rules.

Think like an attacker. For each method, ask: "How can I abuse this? What's the worst input? What if I'm not the owner?"

Attack vectors to probe:
1. Access control — can an unauthorized account call privileged methods (withdraw, mint, admin, set_*)?
2. Fund theft — can I redirect a payment, withdraw more than I'm owed, or claim funds that aren't mine?
3. Fund lockup — can deposited funds get permanently stuck with no recovery path?
4. Logic dead-ends — can the contract reach a state where required actions become impossible?
5. Payment validation — if it reads grouped payments (gtxn), does it validate BOTH receiver AND amount? Can I underpay or send payment elsewhere?
6. Authorization gaps — missing assert(Txn.sender == owner) on state-changing methods.
7. Invariant violations — does the contract uphold the business rules it's supposed to guarantee?

Only report issues you can describe a concrete exploit for. Do NOT nitpick style or report theoretical issues you can't exploit.

Respond ONLY with valid JSON (no markdown):
{
  "findings": [
    {
      "severity": "critical" | "warning" | "info",
      "title": "short title",
      "detail": "the concrete exploit: who calls what, with what input, to cause what harm",
      "fix_hint": "concrete one-line fix"
    }
  ]
}
If you cannot find a real exploit, return {"findings": []}. Quality over quantity — only confident, exploitable findings."""


async def run_llm_audit(contract_code: str, spec: dict, framework: str) -> list[Finding]:
    """LLM deep-review for risky contracts. Returns findings (empty on failure — non-blocking)."""
    # Inject the spec's business_logic as invariants the auditor must verify
    business_logic = spec.get("business_logic", [])
    invariants_block = ""
    if business_logic:
        rules = "\n".join(f"  - {r}" for r in business_logic)
        invariants_block = (
            f"\n## INVARIANTS THIS CONTRACT MUST UPHOLD (from spec)\n{rules}\n"
            "For each invariant, check: can an attacker violate it? If yes, that's a critical finding.\n"
        )

    user_prompt = (
        f"## CONTRACT SPEC\n{json.dumps(spec, indent=2)[:2000]}\n"
        f"{invariants_block}\n"
        f"## CONTRACT CODE ({framework})\n```typescript\n{contract_code[:6000]}\n```\n\n"
        "Attack this contract. Report only confident, exploitable security or logic issues as JSON."
    )
    try:
        response = await generate_completion(
            system_prompt=AUDITOR_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=0.0,
            max_tokens=1500,
            caller="security_auditor",
        )
    except InvalidApiKeyError:
        raise
    except Exception as e:
        logger.warning(f"[AUDITOR] LLM audit failed (non-blocking): {e}")
        return []

    if not response:
        return []

    # Parse JSON
    try:
        match = re.search(r"\{[\s\S]*\}", response)
        data = json.loads(match.group(0) if match else response)
        raw = data.get("findings", [])
    except (json.JSONDecodeError, AttributeError) as e:
        logger.warning(f"[AUDITOR] Could not parse LLM audit response: {e}")
        return []

    findings: list[Finding] = []
    for i, f in enumerate(raw):
        sev = str(f.get("severity", "info")).lower()
        if sev not in ("critical", "warning", "info"):
            sev = "info"
        findings.append(Finding(
            id=f"llm_{i}",
            severity=sev,
            title=str(f.get("title", "Issue"))[:120],
            detail=str(f.get("detail", ""))[:400],
            fix_hint=str(f.get("fix_hint", "")) or None,
            source="llm",
        ))
    return findings


# ─────────────────────────────────────────────────────────────────────────────
# Public entry point
# ─────────────────────────────────────────────────────────────────────────────

async def audit_contract(
    contract_code: str,
    spec: dict,
    template_type: str,
    framework: str = "puyats",
    deep_review: Optional[bool] = None,
) -> AuditReport:
    """
    Audit a compiled contract.

    deep_review: force LLM review on/off. If None, auto-decides based on template_type.
    """
    report = AuditReport()

    # Always run deterministic checks
    det_findings = run_deterministic_checks(contract_code, framework)
    report.findings.extend(det_findings)
    report.checks_run = 4  # access, underflow, fund-recovery, payment-validation

    # Decide whether to run LLM deep review.
    # Prefer the Architect's capability flags; fall back to code inspection.
    should_deep = deep_review
    if should_deep is None:
        caps = spec.get("capabilities") or {}
        if caps:
            should_deep = bool(
                caps.get("is_financial")
                or caps.get("uses_payments")
                or caps.get("sends_funds")
            )
        else:
            # Fallback: detect fund handling from the compiled code
            handles_funds = (
                "itxn.payment" in contract_code
                or "itxn.assetTransfer" in contract_code.replace("AssetTransfer", "assetTransfer")
                or "gtxn.PaymentTxn" in contract_code
                or "gtxn.AssetTransferTxn" in contract_code
                or "currentApplicationAddress" in contract_code
            )
            should_deep = template_type in FINANCIAL_TEMPLATES or handles_funds

    if should_deep:
        llm_findings = await run_llm_audit(contract_code, spec, framework)
        report.findings.extend(llm_findings)
        report.llm_reviewed = True

    # De-duplicate similar findings (same title)
    seen_titles = set()
    unique: list[Finding] = []
    for f in report.findings:
        key = f.title.lower().strip()
        if key in seen_titles:
            continue
        seen_titles.add(key)
        unique.append(f)
    report.findings = unique

    logger.info(f"[AUDITOR] {report.summary()}")
    return report
