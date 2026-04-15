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
Use ONE of these exact categories: token_vault, crowdfunding, voting, nft, escrow, marketplace, subscription, lottery, counter, transfer, game, token, defi, dao, custom

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
- template_type MUST be one of: token_vault, crowdfunding, voting, nft, escrow, marketplace, subscription, lottery, counter, transfer, game, token, defi, dao, custom

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
