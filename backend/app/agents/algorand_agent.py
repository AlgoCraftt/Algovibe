"""
Algorand Agent - Generates Algorand smart contracts with multi-framework support.

This agent replaces the move_agent.py. It follows the RAG approach to
retrieve relevant Algorand documentation and generates contract code
in the requested framework: puyapy (Python) or puyats (TypeScript).

Fixes applied:
  1. _load_skills() now loads ALL reference files (not just storage.md)
  2. System prompt uses correct imports and explict BANNED patterns
  3. Retries inject error-specific corrections (not just "fix this")
  4. First generation uses a golden skeleton to prevent structural errors
  5. Pre-compilation sanitizer (Solution A)
  6. Verified few-shot examples (Solution B)
"""

import re
import logging
import json
from pathlib import Path
from typing import Optional

from app.core.llm import generate_completion

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SKILLS_BASE = Path(__file__).resolve().parent.parent.parent / "knowledge" / "algorand-agent-skills" / "skills"

# Known compiler error patterns → (short label, exact correction to inject)
ERROR_CORRECTIONS = [
    (
        re.compile(r"onComplete|'OptIn'|onOptIn|AbiMethodConfig.*onComplete", re.IGNORECASE),
        "onComplete / onOptIn in @abimethod",
        """CORRECTION — OptIn handling:
WRONG:  @abimethod({ onComplete: 'OptIn' })
WRONG:  @abimethod({ onOptIn: 'require' })
RIGHT:  Use the convention-based lifecycle method name instead of @abimethod decorator:
        public optInToApplication(): void { ... }
  OR if you must use a decorator:
        @abimethod({ allowActions: 'OptIn' })
        public optIn(): void { ... }
Do NOT pass 'onComplete' or 'onOptIn' as keys inside @abimethod({}). They are not valid.""",
    ),
    (
        re.compile(r"gtxn\[|can't be used to index type 'typeof gtxn'", re.IGNORECASE),
        "gtxn array indexing",
        """CORRECTION — Group transaction access:
WRONG:  const payment = gtxn[0]
WRONG:  const payment = gtxn[Uint64(0)]
RIGHT:  const payment = gtxn.PaymentTxn(Uint64(1))   // for payment
        const xfer = gtxn.AssetTransferTxn(Uint64(0)) // for asset transfer
        const app  = gtxn.ApplicationCallTxn(Uint64(2))// for app call
Use typed accessor functions — gtxn is NOT an array. Index is always Uint64(n).""",
    ),
    (
        re.compile(r"sendPayment|has no exported member 'sendPayment'", re.IGNORECASE),
        "sendPayment import",
        """CORRECTION — Sending payments from the contract:
WRONG:  import { sendPayment } from '@algorandfoundation/algorand-typescript'
WRONG:  sendPayment({ receiver: addr, amount: amt })
RIGHT:  import { itxn, Uint64 } from '@algorandfoundation/algorand-typescript'
        itxn.payment({ receiver: addr, amount: amt, fee: Uint64(0) }).submit()
'sendPayment' does not exist. Use itxn.payment() for inner payment transactions.""",
    ),
    (
        re.compile(r"Cannot find name 'bool'|'bool' is not defined", re.IGNORECASE),
        "bool type",
        """CORRECTION — Boolean type:
WRONG:  GlobalState<bool>
WRONG:  (): [uint64, bool]
RIGHT:  GlobalState<boolean>
        (): [uint64, boolean]
In Algorand TypeScript, the AVM boolean type is spelled 'boolean', not 'bool'.""",
    ),
    (
        re.compile(r"objectsInner|Txn\.objectsInner|Property 'objectsInner' does not exist", re.IGNORECASE),
        "Txn.objectsInner",
        """CORRECTION — Accessing inner transactions from Txn:
WRONG:  const payment = Txn.objectsInner[0]
RIGHT:  Use gtxn to access transactions in the current group:
        const payment = gtxn.PaymentTxn(Uint64(0))
Txn refers to the current transaction, not the group. Use gtxn for group access.""",
    ),
    (
        re.compile(r"'clone' is not exported|has no exported member 'clone'", re.IGNORECASE),
        "clone import path",
        """CORRECTION — clone() import:
WRONG:  import { clone } from 'some-wrong-path'
RIGHT:  import { clone } from '@algorandfoundation/algorand-typescript'
clone() IS a valid export from the algorand-typescript package.""",
    ),
    (
        re.compile(r"number.*is not assignable|number.*not.*uint64|infer.*number", re.IGNORECASE),
        "JavaScript number literal",
        """CORRECTION — Never use raw JavaScript number literals:
WRONG:  const amount = 100
WRONG:  counter + 1
RIGHT:  const amount: uint64 = Uint64(100)
        counter + Uint64(1)
Always explicitly type arithmetic results as uint64.""",
    ),
]


class AlgorandAgent:
    """Generates Algorand smart contracts in the selected framework."""

    # ── Framework configs ────────────────────────────────────────────────────
    FRAMEWORK_CONFIGS = {
        "puyapy": {
            "language": "python",
            "file_extension": ".py",
            "skill_path": "algorand-typescript",  # Closest available; Python refs under build-smart-contracts
            "system_prompt": """You are an expert Algorand Python (PuyaPy) developer.
Generate a complete, compilable Algorand Python smart contract using the Puya compiler.

CRITICAL RULES:
- NEVER use PyTEAL or Beaker — they are legacy and deprecated
- NEVER write raw TEAL — always use Algorand Python
- Import from algopy (ARC4Contract, arc4, Global, Txn, etc.)
- Extend ARC4Contract for ABI compliance
- Use @arc4.abimethod decorator for public methods
- Use GlobalState[T] and LocalState[T] for typed state — declare in __init__, NOT as class vars
- Use arc4 types for ABI: arc4.UInt64, arc4.String, arc4.Bool, arc4.Address
- Use algopy.UInt64 for arithmetic (NOT Python int)
- Inner transactions: itxn.Payment(receiver=addr, amount=amt).submit()

Follow the syntax rules in the SKILLS section below.
Output ONLY the code — no explanation, no markdown fence.""",
        },
        "puyats": {
            "language": "typescript",
            "file_extension": ".algo.ts",
            "skill_path": "algorand-typescript",
            "system_prompt": """You are an expert Algorand TypeScript (PuyaTS) developer.
Generate a complete, compilable Algorand TypeScript smart contract for the Puya compiler.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY IMPORT LINE (copy exactly — remove any symbol you do not use):
import { Contract, GlobalState, LocalState, BoxMap, Box, abimethod, baremethod, uint64, bytes, Txn, Global, Uint64, Bytes, assert, Account, itxn, gtxn, clone } from '@algorandfoundation/algorand-typescript'
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CRITICAL ARC32 REQUIREMENT:
You MUST use the @abimethod() decorator on EVERY public method that should be callable from the frontend. If you forget @abimethod(), the method will be hidden from the UI!

BANNED — The compiler will REJECT these. Never write them:
❌ boolean, string in import  → they are native TS, DO NOT import them
❌ sendPayment(...)             → use itxn.payment({...}).submit()
❌ gtxn[0] or gtxn[Uint64(0)]  → use gtxn.PaymentTxn(Uint64(0)) or gtxn.AssetTransferTxn(Uint64(0))
❌ @abimethod({ onComplete: ... })  → use @abimethod({ allowActions: 'OptIn' }) or optInToApplication()
❌ @abimethod({ onOptIn: ... })     → same as above — 'onOptIn' is not a valid key
❌ GlobalState<bool>           → use GlobalState<boolean>
❌ Txn.objectsInner            → use gtxn.PaymentTxn(Uint64(n)) for group access
❌ const amount = 100          → use const amount: uint64 = Uint64(100)
❌ import external npm packages into contract code

LIFECYCLE CONVENTIONS (use these named methods — no decorator needed):
  createApplication()   → called on app creation (OnCompletion = NoOp + isCreate)
  optInToApplication()  → called on OptIn
  closeOutOfApplication() → called on CloseOut
  updateApplication()   → called on Update
  deleteApplication()   → called on Delete

VERIFIED EXAMPLE 1 (Counter):
```typescript
import { Contract, GlobalState, abimethod, uint64, Uint64 } from '@algorandfoundation/algorand-typescript'

export class Counter extends Contract {
  counter = GlobalState<uint64>({ key: 'c' })

  public createApplication(): void {
    this.counter.value = Uint64(0)
  }

  @abimethod()
  public increment(): uint64 {
    this.counter.value = this.counter.value + Uint64(1)
    return this.counter.value
  }
}
```

VERIFIED EXAMPLE 2 (Asset Transfer):
```typescript
import { Contract, itxn, Uint64, bytes, Account } from '@algorandfoundation/algorand-typescript'

export class AssetMinter extends Contract {
  @abimethod()
  public transferAsset(assetId: uint64, receiver: Account, amount: uint64): void {
    itxn.assetTransfer({
      xferAsset: assetId,
      assetReceiver: receiver,
      assetAmount: amount,
      fee: Uint64(0)
    }).submit()
  }
}
```

Follow ALL rules in the SKILLS section. Output ONLY the code — no explanation, no markdown fence.""",
        },
    }

    def __init__(self, framework: str):
        if framework not in self.FRAMEWORK_CONFIGS:
            logger.warning(f"Unknown framework: {framework}. Defaulting to puyats.")
            framework = "puyats"
        self.framework = framework
        self.config = self.FRAMEWORK_CONFIGS[framework]

    # ── Solution A: Pre-compilation Sanitizer ────────────────────────────────

    def _sanitize_code(self, code: str) -> str:
        """Deterministic code fixes BEFORE compilation."""
        if self.framework == "puyats":
            # 1. Remove invalid native TS imports from @algorandfoundation/algorand-typescript
            # Matches 'boolean' and 'string' inside the { ... } block
            code = re.sub(r'import\s+\{[^}]*?\b(boolean|string)\b[^}]*?\}\s+from\s+[\'"]@algorandfoundation/algorand-typescript[\'"]', 
                         lambda m: m.group(0).replace('boolean,', '').replace(', boolean', '').replace('boolean', '')
                                             .replace('string,', '').replace(', string', '').replace('string', ''),
                         code)
            # Cleanup any double commas or empty imports like { , }
            code = code.replace(', ,', ',').replace('{ ,', '{').replace(', }', '}').replace('{  }', '{}')

            # 2. Remove 'sendPayment' from imports if LLM hallucinated it
            code = re.sub(r',\s*sendPayment\b', '', code)
            code = re.sub(r'\bsendPayment\s*,', '', code)

            # 3. Strip XML-like tags if LLM got confused with JSX/Generics
            code = re.sub(r'</?(abimethod|Contract|ContractBase)>', '', code)

            # 4. Fix common TS number inference issues (heuristic)
            # Ensure Global.latestTimestamp - last_update results in uint64
            code = re.sub(r'const (\w+) = Global\.latestTimestamp - (\w+)', 
                         r'const \1: uint64 = Global.latestTimestamp - \2', code)

        return code

    # ── Fix 1: Load ALL reference files ─────────────────────────────────────

    def _load_skills(self) -> str:
        """
        Load ALL skill reference files for the active framework.
        """
        framework_path = SKILLS_BASE / self.config["skill_path"]
        skill_contents = []

        # 1. Primary SKILL.md
        skill_main = framework_path / "SKILL.md"
        if skill_main.exists():
            skill_contents.append(f"## {self.framework.upper()} CORE RULES\n{skill_main.read_text(encoding='utf-8')}")

        # 2. ALL reference docs in references/
        refs_dir = framework_path / "references"
        if refs_dir.exists():
            for ref_file in sorted(refs_dir.glob("*.md")):
                if ref_file.name == "REFERENCE.md":
                    continue
                section_title = f"REFERENCE: {ref_file.stem.upper().replace('-', ' ')}"
                skill_contents.append(f"## {section_title}\n{ref_file.read_text(encoding='utf-8')}")

        # 3. Troubleshooting skill
        trouble_main = SKILLS_BASE / "troubleshoot-errors" / "SKILL.md"
        if trouble_main.exists():
            skill_contents.append(f"## COMMON ERRORS & FIXES\n{trouble_main.read_text(encoding='utf-8')}")

        loaded = [s.split('\n')[0] for s in skill_contents]
        logger.info(f"[ALGORAND_AGENT] Loaded {len(skill_contents)} skill sections: {loaded}")
        return "\n\n---\n\n".join(skill_contents)

    # ── Fix 3: Error-specific retry corrections ──────────────────────────────

    def _build_error_corrections(self, error_context: str) -> str:
        """
        Pattern-match known compiler errors and return exact corrections.
        """
        if not error_context:
            return ""

        matched = []
        for pattern, label, correction in ERROR_CORRECTIONS:
            if pattern.search(error_context):
                matched.append(f"### Error: {label}\n{correction}")
                logger.info(f"[ALGORAND_AGENT] Detected error pattern: {label}")

        if not matched:
            return ""

        header = "## TARGETED CORRECTIONS FOR THIS RETRY\n\nThe compiler rejected specific patterns. Apply these EXACT fixes:\n\n"
        return header + "\n\n".join(matched)

    # ── Fix 4: Golden skeleton template ─────────────────────────────────────

    def _get_contract_skeleton(self, contract_name: str) -> str:
        """
        Return a structural skeleton the LLM must follow.
        """
        if self.framework == "puyats":
            safe_name = "".join(
                word.capitalize() for word in re.sub(r"[^a-zA-Z0-9 ]", "", contract_name).split()
            ) or "MyContract"
            return f"""## GOLDEN SKELETON (follow this structure exactly)

```typescript
// DO NOT change the import line or class declaration structure
// FILL IN only the sections marked === FILL ===

import {{ Contract, GlobalState, LocalState, BoxMap, abimethod, uint64, bytes, Txn, Global, Uint64, Bytes, assert, Account, itxn, gtxn, clone }} from '@algorandfoundation/algorand-typescript'

// === FILL: type definitions (plain TypeScript objects — NOT arc4.Struct) ===

export class {safe_name} extends Contract {{

  // === FILL: state declarations (GlobalState<T>, LocalState<T>, BoxMap<K,V>) ===
  // Example: counter = GlobalState<uint64>({{ key: 'c' }})

  public createApplication(): void {{
    // === FILL: initialization logic — set initial state values here ===
  }}

  // === FILL: public business methods ===
  // Use: public methodName(param: uint64): uint64 {{ ... }}
  // Convention opt-in: public optInToApplication(): void {{ ... }}
}}
```

Fill in the === FILL === sections. Do not deviate from the import line or class structure."""

        else:  # puyapy
            safe_name = "".join(
                word.capitalize() for word in re.sub(r"[^a-zA-Z0-9 ]", "", contract_name).split()
            ) or "MyContract"
            return f"""## GOLDEN SKELETON (follow this structure exactly)

```python
# DO NOT change the import line or class structure
# FILL IN only the sections marked === FILL ===

from algopy import ARC4Contract, GlobalState, LocalState, UInt64, Bytes, Account, arc4, Txn, Global, itxn

# === FILL: any helper types or constants ===

class {safe_name}(ARC4Contract):
    # === FILL: declare state in __init__ ===
    # Example: self.counter: GlobalState[UInt64]

    def __init__(self) -> None:
        # === FILL: initialize state ===
        self.counter = GlobalState(UInt64(0))

    @arc4.abimethod(create='require')
    def create_application(self) -> None:
        # === FILL: creation logic ===
        pass

    # === FILL: public ABI methods ===
    # @arc4.abimethod
    # def my_method(self, param: arc4.UInt64) -> arc4.UInt64: ...
```"""

    # ── Main generation method ────────────────────────────────────────────────

    async def generate_contract(
        self,
        spec: dict,
        docs_context: list[str],
        previous_code: Optional[str] = None,
        error_context: Optional[str] = None,
    ) -> dict:
        """
        Generate a smart contract using all fixes:
          1. Full skill context (all reference files)
          2. Accurate system prompt with BANNED patterns
          3. Error-specific corrections on retry
          4. Golden skeleton on first attempt
          5. Pre-compilation sanitizer (Solution A)
          6. Verified few-shot examples (Solution B)
        """
        skills_context = self._load_skills()

        full_system_prompt = (
            f"{self.config['system_prompt']}\n\n"
            f"### SKILLS & REFERENCE DOCUMENTATION\n{skills_context}"
        )

        context = "\n\n".join(docs_context)
        contract_name = spec.get("name", "MyContract")
        is_retry = bool(previous_code and error_context)

        # Build user prompt
        prompt_parts = [
            f"## CONTRACT SPECIFICATION\n{json.dumps(spec, indent=2)}",
            f"## DOCUMENTATION CONTEXT\n{context}",
        ]

        if is_retry:
            targeted_corrections = self._build_error_corrections(error_context)
            prompt_parts.append(f"## PREVIOUS CODE (FAILED TO COMPILE)\n```typescript\n{previous_code}\n```")
            prompt_parts.append(f"## COMPILER ERROR OUTPUT\n{error_context}")

            if targeted_corrections:
                prompt_parts.append(targeted_corrections)
            else:
                prompt_parts.append(
                    "## RETRY INSTRUCTIONS\n"
                    "The previous code had compiler errors. Review the SKILLS references above "
                    "and fix all issues. Output the COMPLETE corrected contract."
                )
        else:
            skeleton = self._get_contract_skeleton(contract_name)
            prompt_parts.append(skeleton)

        prompt_parts.append("Generate the complete smart contract code now. Output ONLY the code, no explanation.")
        prompt = "\n\n".join(prompt_parts)

        logger.info(f"[ALGORAND_AGENT] Generating {self.framework} contract '{contract_name}' (retry={is_retry})")

        code = await generate_completion(
            system_prompt=full_system_prompt,
            user_prompt=prompt,
            temperature=0.05,
            max_tokens=4096,
        )

        if not code:
            raise RuntimeError("LLM returned empty contract code")

        code = code.strip()

        # Robust code extraction
        code_blocks = re.findall(r"```(?:\w+)?\s*\n?(.*?)```", code, re.DOTALL)
        if code_blocks:
            code = max(code_blocks, key=len).strip()
        else:
            if self.framework == "puyats":
                start_markers = ["import {", "import{"]
            else:
                start_markers = ["from algopy", "import algopy", "from typing"]

            for marker in start_markers:
                idx = code.find(marker)
                if idx != -1:
                    code = code[idx:].strip()
                    if "```" in code:
                        code = code.split("```")[0].strip()
                    break
            else:
                code = code.replace("```typescript", "").replace("```python", "").replace("```", "").strip()

        # Solution A: Sanitizer
        code = self._sanitize_code(code)

        if not code:
            raise RuntimeError("Failed to extract code from LLM response")

        return {
            "contract_code": code,
            "filename": contract_name.lower().replace(" ", "_"),
            "language": self.config["language"],
            "extension": self.config["file_extension"],
        }
