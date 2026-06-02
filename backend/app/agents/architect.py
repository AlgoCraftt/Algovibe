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


ARCHITECT_SYSTEM_PROMPT = """You are the Architect Agent for AlgoCraft, a text-to-DApp engine for Algorand.

Your job is to analyze user requests and create a SIMPLE, FOCUSED specification for an Algorand smart contract using the Puya compiler (Algorand Python/TypeScript).

## CRITICAL CONSTRAINTS — Algorand (Puya):
- Keep contracts SMALL: 3-5 methods maximum (create + 2-3 core actions + 1-2 getters)
- Algorand/Puya types: uint64, bytes, str, bool, Address
- Use uint64 for all numeric values and amounts
- NO floating point.
- State types:
  - global_state: list of {name, type, description}
  - local_state: list of {name, type, description} (per-user)
  - box_storage: list of {name, key_type, value_type} (dynamic data)
- Methods: list of {name, args: [{name, type}], returns: type, description, on_complete}

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
1. An on-chain Algorand contract that acts as a payment escrow/registry (tracks payments, manages access credits)
2. An off-chain server + client pattern using x402 protocol middleware

For x402_service specs:
- The contract should handle payment tracking/escrow on-chain
- Include methods like: create (init service config), record_payment (log payment), get_access_count (read credits), withdraw (owner withdraws earnings)
- The ui_requirements should describe an x402 client demo UI that shows the pay-and-access flow
- Add "x402_integration": true to the spec so downstream agents know to generate x402 middleware code

## EXAMPLE GOOD SPEC (for "Build a pay-per-call weather API using x402"):
{
  "template_type": "x402_service",
  "spec": {
    "name": "WeatherPayPerCall",
    "description": "A pay-per-call weather API that charges USDC per request using x402 protocol on Algorand",
    "x402_integration": true,
    "x402_config": {
      "price_per_call": "$0.01",
      "payment_asset": "USDC",
      "network": "testnet",
      "facilitator_url": "https://facilitator.goplausible.xyz"
    },
    "global_state": [
      {"name": "owner", "type": "Address", "description": "Service owner who receives payments"},
      {"name": "total_calls", "type": "uint64", "description": "Total API calls served"},
      {"name": "total_earned", "type": "uint64", "description": "Total microUSDC earned"},
      {"name": "price_per_call", "type": "uint64", "description": "Price per call in microUSDC"}
    ],
    "local_state": [],
    "box_storage": [],
    "methods": [
      {"name": "create", "args": [{"name": "price_per_call", "type": "uint64"}], "returns": "void", "description": "Initialize service with price config", "on_complete": "NoOp"},
      {"name": "record_payment", "args": [{"name": "caller", "type": "Address"}, {"name": "amount", "type": "uint64"}], "returns": "void", "description": "Record a verified payment from facilitator", "on_complete": "NoOp"},
      {"name": "get_stats", "args": [], "returns": "uint64", "description": "Get total calls served", "on_complete": "NoOp"},
      {"name": "withdraw", "args": [], "returns": "void", "description": "Owner withdraws accumulated earnings", "on_complete": "NoOp"}
    ],
    "ui_requirements": ["Service dashboard showing total calls and earnings", "Demo pay-per-call button that simulates x402 flow", "Price display and payment status", "Owner withdraw earnings button"],
    "business_logic": ["Only owner can withdraw", "Payment recording verifies caller identity", "Price is set at creation and tracked on-chain"]
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
    "business_logic": ["..."]
  }
}"""


ARCHITECT_USER_PROMPT = """User request: {prompt}

Create a SIMPLE contract spec for Algorand using Puya. Remember:
- Maximum 5 methods
- Types: uint64, bytes, str, bool, Address
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
                
            return AnalysisResult(
                template_type=data["template_type"],
                spec=data["spec"]
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
