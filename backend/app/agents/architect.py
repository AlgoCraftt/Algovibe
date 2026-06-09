"""
Architect Agent - Analyzes user prompts and creates Algorand contract specifications

This agent is responsible for:
1. Understanding user intent from natural language
2. Creating a detailed specification for an Algorand smart contract
3. Identifying required methods, state (global/local/box), and parameters
4. Specifying UI requirements for the frontend
"""

import json
import logging
from typing import TypedDict

from app.core.llm import generate_completion

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class AnalysisResult(TypedDict):
    template_type: str  # Descriptive category
    spec: dict


# Templates that inherently handle value (used for is_financial fallback)
_FINANCIAL_TEMPLATES = {
    "escrow", "crowdfunding", "token_vault", "marketplace", "lottery",
    "defi", "dao", "subscription", "x402_service", "token",
}

# Method-name hints for fund movement
_FUND_OUT_HINTS = ("withdraw", "claim", "payout", "refund", "release", "distribute", "send", "transfer")
_PAYMENT_ARG_TYPES = ("pay", "payment", "axfer", "asset")


def derive_capabilities(spec: dict, template_type: str) -> dict:
    """
    Fallback capability derivation when the LLM omits or under-specifies the
    capabilities block. Inspects the spec structurally so downstream agents
    always have a reliable signal.
    """
    methods = spec.get("methods", []) or []
    local_state = spec.get("local_state", []) or []
    box_storage = spec.get("box_storage", []) or []

    # uses_payments: any method takes a payment-type arg, or x402 (verifies gtxn)
    uses_payments = template_type == "x402_service" or any(
        str(a.get("type", "")).lower() in _PAYMENT_ARG_TYPES
        for m in methods
        for a in (m.get("args", []) or [])
    )

    # sends_funds: any method name hints at fund movement out
    sends_funds = any(
        any(h in str(m.get("name", "")).lower() for h in _FUND_OUT_HINTS)
        for m in methods
    )

    uses_local_state = len(local_state) > 0
    uses_box_storage = len(box_storage) > 0

    is_financial = (
        template_type in _FINANCIAL_TEMPLATES
        or uses_payments
        or sends_funds
        or spec.get("x402_integration", False)
    )

    return {
        "uses_payments": uses_payments,
        "sends_funds": sends_funds,
        "uses_local_state": uses_local_state,
        "uses_box_storage": uses_box_storage,
        "is_financial": is_financial,
    }


def ensure_capabilities(spec: dict, template_type: str) -> dict:
    """
    Merge LLM-provided capabilities with structural derivation.
    Structural detection takes precedence for the safety-critical flags
    (a method that sends funds MUST be flagged even if the LLM said false).
    """
    derived = derive_capabilities(spec, template_type)
    llm_caps = spec.get("capabilities", {}) or {}

    # OR-merge: if EITHER the LLM or structural detection flags it, it's true.
    # This is the safe direction — over-detecting a capability is harmless,
    # under-detecting (e.g. missing local_state opt-in) breaks the dApp.
    merged = {}
    for key, derived_val in derived.items():
        merged[key] = bool(derived_val or llm_caps.get(key, False))
    return merged


ARCHITECT_SYSTEM_PROMPT = """You are the Architect Agent for AlgoCraft, a text-to-DApp engine for Algorand.

Your job is to analyze user requests and create a SIMPLE, FOCUSED specification for an Algorand smart contract using the Puya compiler (Algorand Python/TypeScript).

## CRITICAL CONSTRAINTS — Algorand (Puya):
- Keep contracts FOCUSED: include exactly the methods the feature needs — no more, no less.
  Most apps need 3-6 methods (create + core actions + getters). Complex apps (escrow with
  dispute, staged crowdfunding) may need more — that's fine. Do NOT pad with admin/pause/
  upgrade methods the user didn't ask for.
- Algorand/Puya types: uint64, bytes, str, bool, Address
- Special argument types: "pay" (a grouped ALGO payment txn), "asset" (an ASA reference)
- Use uint64 for all numeric values and amounts
- NO floating point.
- State types:
  - global_state: list of {name, type, description}
  - local_state: list of {name, type, description} (per-user)
  - box_storage: list of {name, key_type, value_type} (dynamic data)
    IMPORTANT: Box storage requires the caller to pre-declare box references in the transaction.
    Use box_storage ONLY when GlobalState/LocalState are insufficient (e.g. storing per-user records
    for unlimited users, large data blobs). For simple counters, flags, or limited user data,
    prefer global_state or local_state — they work without extra transaction configuration.
- Methods: list of {name, args: [{name, type}], returns: type, description, on_complete}

## SCOPE DISCIPLINE:
- Model ONLY what the user explicitly asked for. Do not infer or add features they didn't mention.
- If the user says "a counter", build a counter — don't add access control, pausing, or admin roles.

## RELIABILITY ENVELOPE (prefer patterns that work end-to-end):
- STRONGLY PREFER global_state and local_state over box_storage. They cover counters, balances,
  per-user records, flags, votes, ownership — the vast majority of apps.
- Use box_storage ONLY when the data is genuinely unbounded (e.g. an unlimited registry of
  arbitrary-length entries). If local_state (per-user) can hold it, use local_state.
- For payments, use native ALGO ("pay" arg type) — it works without ASA opt-in friction.
- Keep methods ABI-callable (@abimethod) so the frontend can wire buttons to them.

## Design Philosophy:
- Every method should map directly to a user action in the UI
- Include a 'create' method and at least one read-only getter
- Keep business logic simple — one clear responsibility per method
- Use ARC4-compliant ABI methods where possible (@abimethod / @arc4.abimethod)

## IMPORTANT RULES for category naming:
Use ONE of these exact categories: token_vault, crowdfunding, voting, nft, escrow, marketplace, subscription, lottery, counter, transfer, game, token, defi, dao, x402_service, custom

## x402 CATEGORY RULES:
If the user mentions x402, pay-per-call, pay-per-request, micropayment API, paid API, payment-gated, agent payment, or agentic commerce, use "x402_service" as the template_type.
x402 apps have TWO parts:
1. An on-chain Algorand contract that VERIFIES payments trustlessly via atomic transaction groups (gtxn)
2. An off-chain server + client pattern using x402 protocol middleware

For x402_service specs:
- The contract MUST verify real payment transactions using gtxn (atomic group) — NOT accept trusted input
- record_payment() should take ZERO arguments — it reads the payment from gtxn.PaymentTxn(0) in the same group
- The contract verifies: payment.receiver == contract address, payment.amount >= price
- Include methods like: create (init price), record_payment (verify + count), get_stats (read), withdraw (owner gets funds)
- The ui_requirements should describe an x402 client demo UI that shows the pay-and-access flow
- Add "x402_integration": true to the spec so downstream agents know to generate x402 middleware code
- CRITICAL: record_payment MUST NOT accept (caller, amount) as arguments — that's insecure. It reads from gtxn.
- IMPORTANT: For the on-chain demo, payment_asset MUST be "ALGO" and prices in microALGO. The contract verifies a PaymentTxn (ALGO), NOT an asset transfer. USDC requires ASA opt-in which breaks the preview. Use ALGO for the live demo; the x402 server code still references USDC conceptually for production.

## EXAMPLE GOOD SPEC (for "Build a pay-per-call weather API using x402"):
{
  "template_type": "x402_service",
  "spec": {
    "name": "WeatherPayPerCall",
    "description": "A pay-per-call weather API that charges ALGO per request using x402 protocol on Algorand",
    "x402_integration": true,
    "x402_config": {
      "price_per_call": "$0.005",
      "payment_asset": "ALGO",
      "network": "testnet",
      "facilitator_url": "https://facilitator.goplausible.xyz"
    },
    "global_state": [
      {"name": "owner", "type": "Address", "description": "Service owner who receives payments"},
      {"name": "total_calls", "type": "uint64", "description": "Total API calls served"},
      {"name": "total_earned", "type": "uint64", "description": "Total microALGO earned"},
      {"name": "price_per_call", "type": "uint64", "description": "Price per call in microALGO"}
    ],
    "local_state": [],
    "box_storage": [],
    "methods": [
      {"name": "create", "args": [{"name": "price_per_call", "type": "uint64"}], "returns": "void", "description": "Initialize service with price config", "on_complete": "NoOp"},
      {"name": "record_payment", "args": [], "returns": "void", "description": "Verify and record payment from atomic group transaction (trustless — reads ALGO PaymentTxn from gtxn)", "on_complete": "NoOp"},
      {"name": "get_stats", "args": [], "returns": "uint64", "description": "Get total calls served", "on_complete": "NoOp"},
      {"name": "withdraw", "args": [], "returns": "void", "description": "Owner withdraws accumulated earnings", "on_complete": "NoOp"}
    ],
    "ui_requirements": ["Service dashboard showing total calls and earnings", "Demo pay-per-call button that triggers the x402 ALGO payment flow", "Price display and payment status", "Owner withdraw earnings button"],
    "business_logic": ["Only owner can withdraw", "Payment verified on-chain via atomic group (gtxn)", "Price is set at creation and tracked on-chain"]
  }
}

## EXAMPLE GOOD SPEC (for "Create a crowdfunding app"):
{
  "template_type": "crowdfunding",
  "spec": {
    "name": "Crowdfunding",
    "description": "A crowdfunding contract where users can create campaigns and contribute ALGO",
    "global_state": [
      {"name": "creator", "type": "Address", "description": "Campaign creator"},
      {"name": "goal", "type": "uint64", "description": "Funding goal in microAlgos"},
      {"name": "deadline", "type": "uint64", "description": "UNIX timestamp deadline"}
    ],
    "local_state": [
      {"name": "contributed", "type": "uint64", "description": "Amount contributed by the user"}
    ],
    "methods": [
      {"name": "create", "args": [{"name": "goal", "type": "uint64"}, {"name": "deadline", "type": "uint64"}], "returns": "void", "description": "Initialize campaign", "on_complete": "NoOp"},
      {"name": "contribute", "args": [{"name": "payment", "type": "pay"}], "returns": "void", "description": "Contribute to campaign", "on_complete": "NoOp"},
      {"name": "claim", "args": [], "returns": "void", "description": "Claim funds if goal reached", "on_complete": "NoOp"},
      {"name": "get_raised", "args": [], "returns": "uint64", "description": "Get total raised"}
    ],
    "ui_requirements": ["Form to create campaign with goal and deadline", "Contribute button with ALGO input", "Campaign status display", "Claim button"],
    "business_logic": ["Only creator can claim", "Cannot contribute after deadline", "Cannot claim unless goal reached"]
  }
}

Respond with ONLY a JSON object:
{
  "template_type": "category_name",
  "spec": {
    "name": "ContractName",
    "description": "One sentence description",
    "global_state": [{"name": "...", "type": "...", "description": "..."}],
    "local_state": [],
    "box_storage": [],
    "methods": [
      {
        "name": "...",
        "args": [{"name": "...", "type": "..."}],
        "returns": "...",
        "description": "...",
        "on_complete": "NoOp"
      }
    ],
    "ui_requirements": ["..."],
    "business_logic": ["..."],
    "capabilities": {
      "uses_payments": false,
      "sends_funds": false,
      "uses_local_state": false,
      "uses_box_storage": false,
      "is_financial": false
    }
  }
}

## CAPABILITIES — set these flags accurately (downstream agents rely on them):
- "uses_payments": true if any method accepts an ALGO/ASA payment (a "pay" arg, or verifies gtxn payment)
- "sends_funds": true if the contract sends funds OUT (withdraw, claim, payout, refund — uses inner transactions)
- "uses_local_state": true if local_state has any entries (requires per-user opt-in)
- "uses_box_storage": true if box_storage has any entries
- "is_financial": true if the contract holds, moves, or accounts for value (payments, balances, tokens)"""


ARCHITECT_USER_PROMPT = """User request: {prompt}

Create a FOCUSED contract spec for Algorand using Puya. Remember:
- Include exactly the methods the feature needs (no padding, no inventing features)
- Types: uint64, bytes, str, bool, Address; special args: "pay", "asset"
- template_type MUST be one of: token_vault, crowdfunding, voting, nft, escrow, marketplace, subscription, lottery, counter, transfer, game, token, defi, dao, x402_service, custom
- If the user mentions x402, pay-per-call, paid API, micropayments, or agentic commerce → use "x402_service" and include "x402_integration": true in the spec

Respond strictly with ONLY a JSON object:"""


async def analyze_prompt(prompt: str) -> AnalysisResult:
    """
    Analyze user prompt and return a detailed Algorand contract specification.
    """
    logger.info(f"[ARCHITECT] Starting analysis of prompt: {prompt[:100]}...")

    response = await generate_completion(
        system_prompt=ARCHITECT_SYSTEM_PROMPT,
        user_prompt=ARCHITECT_USER_PROMPT.format(prompt=prompt),
        caller="architect",
        temperature=0.1,
        max_tokens=4000,
    )

    if not response:
        logger.error("[ARCHITECT] LLM returned empty response")
        raise RuntimeError("Failed to analyze prompt")

    try:
        # Robust JSON extraction: look for the first '{' and the last '}'
        start_idx = response.find('{')
        end_idx = response.rfind('}')
        
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            json_str = response[start_idx:end_idx+1]
            data = json.loads(json_str)
            
            # Validation
            if "template_type" not in data or "spec" not in data:
                logger.error(f"[ARCHITECT] Missing required keys. Response: {response}")
                raise RuntimeError("Architect returned an incomplete specification")

            template_type = data["template_type"]
            spec = data["spec"]

            # Ensure capabilities are present and accurate (single source of truth)
            spec["capabilities"] = ensure_capabilities(spec, template_type)
            logger.info(f"[ARCHITECT] Capabilities: {spec['capabilities']}")

            return AnalysisResult(
                template_type=template_type,
                spec=spec
            )
        else:
            logger.error(f"[ARCHITECT] No JSON found in response: {response}")
    except json.JSONDecodeError as e:
        logger.error(f"[ARCHITECT] JSON parse error: {e}. Raw response: {response}")
        raise RuntimeError(f"Failed to parse spec: {e}")
    except Exception as e:
        logger.error(f"[ARCHITECT] Error processing response: {e}")
        raise RuntimeError(f"Failed to process specification: {e}")

    raise RuntimeError("Failed to extract specification from response")
