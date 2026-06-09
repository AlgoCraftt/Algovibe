# Agent Deep Dive — Flaws & Best-Practice Comparison

> Analysis of the four agents in `backend/app/agents/` against current AI-codegen and smart-contract-generation best practices. Each agent analyzed for structure, prompt quality, and bottlenecks.

---

## Industry Best Practices (the benchmark)

From current research on AI smart-contract generation (Coinbase x402, AlgoKit patterns, 2025 prompt-engineering guides):

1. **Treat prompts like contracts** — clear task, allowed inputs, hard constraints, exact output shape, validation method
2. **Inject protocol context + invariants** every call (don't rely on model's training knowledge of niche frameworks)
3. **Structured JSON output** with schema validation, not free-form
4. **Separate concerns** — planning ≠ generation ≠ auditing ≠ remediation
5. **Few-shot with VERIFIED examples** — examples must actually compile
6. **Adversarial role for auditors** — "you are an attacker"
7. **Iterative control loops** with targeted feedback (not "try again")
8. **Ground in retrieval (RAG)** for framework-specific syntax

---

## 1. ARCHITECT AGENT (`architect.py`)

**Role:** Prompt → JSON spec (methods, state, types)

### What's good
- Clear category enum (forces consistent `template_type`)
- Two solid few-shot examples (x402 + crowdfunding)
- Robust JSON extraction (first `{` to last `}`)
- Low temperature (0.1) for deterministic structure

### Flaws / Bottlenecks

| # | Flaw | Impact |
|---|------|--------|
| A1 | **No JSON schema validation** — only checks `template_type` and `spec` keys exist. A malformed `methods` array passes through and breaks the downstream agent | Medium |
| A2 | **"Maximum 5 methods" is arbitrary** — complex but valid apps (escrow with dispute, multi-stage crowdfunding) get artificially truncated | High — this is a real bottleneck |
| A3 | **Type system is under-specified** — says "uint64, bytes, str, bool, Address" but never explains `pay` type (used in crowdfunding example) or arc4 tuple returns | Medium |
| A4 | **No validation that methods map to template_type** — a "voting" template could come back with escrow methods | Low |
| A5 | **x402 rules are 40% of the prompt** — massively over-weighted for one template type. Bloats context for every non-x402 request | Medium — wastes tokens, dilutes focus |
| A6 | **No "don't infer missing facts" instruction** — the model invents requirements not in the user prompt | Medium |
| A7 | **Single-shot, no self-critique** — no step where it validates its own spec against the user intent | Medium |

### Recommended fixes
- Add a real JSON schema validator (pydantic model) — reject + retry on malformed specs
- Replace "max 5 methods" with "as many as the feature needs, but each maps to one user action"
- Move x402 rules to a **conditional block** appended only when x402 keywords detected (like the skill loading does)
- Add explicit type reference: `pay` (grouped payment), `asset` (ASA ref), tuple returns
- Add: "Only model what the user asked for. Do not add admin/pause/upgrade unless requested."

---

## 2. ALGORAND AGENT (`algorand_agent.py`) ⭐ The Core Bottleneck

**Role:** Spec → PuyaTS/PuyaPy contract code

### What's good
- **Excellent BANNED-patterns list** — 15+ specific anti-patterns with WRONG/RIGHT pairs (this is genuinely strong)
- **Error-specific retry corrections** — 12 regex-matched compiler errors → exact fixes (best feature in the codebase)
- **Golden skeleton** on first attempt (structural guardrail)
- **Pre-compilation sanitizer** — deterministic fixes before sending to compiler
- **Verified few-shot examples** that actually compile
- **Skill loading from RAG** (knowledge/algorand-agent-skills)

### Flaws / Bottlenecks

| # | Flaw | Impact |
|---|------|--------|
| B1 | **System prompt is ~6000+ chars of rules before any task** — the model spends huge attention budget on "don't do X" instead of "build Y". Negative instructions are weaker than positive examples | **HIGH — primary bottleneck** |
| B2 | **`max_tokens=4096` is too low** — complex contracts (escrow + box storage + multiple methods) get truncated mid-generation. This causes compile failures that look like "syntax errors" but are actually cutoffs | **HIGH** |
| B3 | **ALL skills loaded every time** (`_load_skills` loads every .md in references/) — could be 20K+ tokens of context. Most isn't relevant to the specific contract | **HIGH — context dilution** |
| B4 | **Sanitizer is regex-based and fragile** — e.g. the "remove return after assert" heuristic can delete legitimate returns in nested blocks. Silent corruption | Medium |
| B5 | **PuyaPy path is an afterthought** — the skeleton, examples, and BANNED list are all PuyaTS. PuyaPy gets a 10-line prompt and a generic skeleton | Medium |
| B6 | **No semantic validation of spec→code** — doesn't verify the generated code actually implements all the spec's methods | Medium |
| B7 | **Retry doesn't escalate strategy** — same approach 5 times. Should switch tactics (e.g., simplify, use different pattern) after 2 failures | Medium |
| B8 | **Skeleton + examples + banned-list overlap heavily** — the same OptIn rule appears in BANNED, in examples, and in error corrections. Redundancy = wasted context | Medium |

### Recommended fixes (priority order)
1. **Raise `max_tokens` to 8192** (B2) — single biggest quick win. Truncation is likely causing demo failures
2. **Make skill loading template-aware** (B3) — load only the references relevant to the spec's features (state? boxes? inner txns? payments?). You already do this for x402 — extend it
3. **Restructure system prompt** (B1): lead with the verified examples (positive), then a SHORT banned list (top 5 only), move the rest to retry-only corrections
4. **Replace fragile sanitizer heuristics** (B4) with safer AST-aware checks or remove the risky ones
5. **Add a post-generation spec coverage check** (B6) — verify each spec method appears in the code before compiling

---

## 3. SECURITY AUDITOR (`security_auditor.py`)

**Role:** Compiled contract → security findings (critical/warning/info)

### What's good
- **Two-layer design** — deterministic checks (instant, free) + LLM review (only for financial templates). This is the right architecture
- **Adversarial-ish prompt** ("senior security auditor")
- Structured JSON output
- Non-blocking (audit failure doesn't kill the pipeline)
- Findings can trigger one regeneration pass

### Flaws / Bottlenecks

| # | Flaw | Impact |
|---|------|--------|
| C1 | **Deterministic checks have false positives** — you already hit this: `payment_amount` flagged a contract that DID validate amount (the regex `assert\([^)]*amount[^)]*>=` failed to match a multi-line assert) | **HIGH — undermines trust** |
| C2 | **Regex method extraction is brittle** — `_extract_methods` only matches `@abimethod(...) public name(args): ret`. Misses methods with line breaks, generics, or `: void` on next line | Medium |
| C3 | **Auditor prompt isn't fully adversarial** — best practice is "you are an attacker trying to drain this contract." Current prompt is "review for issues" — softer | Medium |
| C4 | **Only `warning` for unvalidated amount, but only `critical` triggers fix** — so the most common real issue (missing amount check) never gets auto-fixed | Medium |
| C5 | **No invariant injection** — doesn't tell the auditor what the contract SHOULD guarantee (from the spec's `business_logic`). Auditing blind | Medium |
| C6 | **LLM audit only runs for `FINANCIAL_TEMPLATES`** — but a "custom" template handling funds gets no deep review | Medium |
| C7 | **Body slicing is approximate** — `_extract_methods` grabs "method start to next @abimethod" which includes trailing class content for the last method | Low |

### Recommended fixes
- Fix C1: make amount-check regex multi-line aware (`re.DOTALL`) or do a simpler substring check for `.amount` + `>=` in proximity
- Inject the spec's `business_logic` as invariants the auditor must verify (C5)
- Reframe auditor prompt adversarially: "You are attacking this contract. Find a way to steal funds or lock them." (C3)
- Run LLM audit whenever the contract receives/sends funds, not just for named templates (C6)

---

## 4. REACT AGENT (`react_agent.py`)

**Role:** ARC-32 spec → App.tsx + hooks

### What's good
- **Wiring completeness rules** (recently added) — forces every method to be called
- **Explicit hook method list** injected (from ARC-32)
- Auto-generated `useContract` hook from ARC-32 (type-safe, deterministic)
- x402 supplement appended conditionally
- Detailed visual design rules (premium UI)

### Flaws / Bottlenecks

| # | Flaw | Impact |
|---|------|--------|
| D1 | **System prompt is enormous** — visual rules + structure template + API rules + opt-in flow + x402 supplement. Easily 8K+ chars. Same attention-dilution problem as B1 | **HIGH** |
| D2 | **Inline styles mandated everywhere** — produces huge App.tsx files that eat output tokens and often get truncated. A CSS-class approach would be far more token-efficient | **HIGH** |
| D3 | **`max_tokens=8000` for a full styled App.tsx** — premium UIs with inline styles routinely exceed this → truncation → broken preview | **HIGH** |
| D4 | **Two sources of truth for method names** — the prompt lists hook methods AND the LLM reads the spec. Confusion leads to snake_case/camelCase mismatches | Medium |
| D5 | **No validation that generated App.tsx imports match generated files** — relies on the separate path-verifier service to catch this after the fact | Medium |
| D6 | **The opt-in example is copy-pasted verbatim into the prompt** — ~50 lines. Good for correctness, bad for context budget | Medium |

### Recommended fixes
- Raise `max_tokens` to 16000 for react_agent (D3) — matches the fix-frontend path
- Move visual design rules into the CSS template (already exists as `DEFAULT_CSS`) and tell the LLM to use classes (D2) — massive token savings
- Split the system prompt: core rules always, opt-in example ONLY when `local_state` exists in spec (D6)

---

## Cross-Cutting Issues (all agents)

| Issue | Description |
|-------|-------------|
| **Context bloat** | Every agent front-loads massive instruction blocks. Models with smaller context (or cheaper tiers) degrade. Total system prompts can exceed 20K tokens before the actual task |
| **Negative-instruction reliance** | Heavy use of "DON'T do X" (BANNED lists). Research shows positive examples + constraints outperform long prohibition lists |
| **No conditional context assembly** | Only `algorand_agent` (x402) and the new react supplement load conditionally. Everything else is always-on |
| **Token limits cause silent truncation** | `max_tokens` of 4096 (contract) / 8000 (react) likely truncate complex outputs, manifesting as "compile errors" |
| **No self-critique loop** | No agent validates its own output against requirements before passing downstream |

---

## Priority Ranking (what to fix first for biggest impact)

| Rank | Fix | Agent | Effort | Impact |
|------|-----|-------|--------|--------|
| 1 | Raise `max_tokens` (4096→8192 contract, 8000→16000 react) | algorand, react | Trivial | **Huge** — stops truncation |
| 2 | Template-aware skill loading (load only relevant refs) | algorand | Medium | High — focus + speed |
| 3 | Fix auditor false-positive regexes (multi-line) | security | Low | High — trust |
| 4 | Conditional context (x402 rules, opt-in example) | architect, react | Medium | High — token savings |
| 5 | Lead with examples, shorten banned list | algorand | Medium | High — better generation |
| 6 | CSS classes instead of inline styles | react | Medium | High — token savings |
| 7 | Inject business_logic invariants into auditor | security | Low | Medium |
| 8 | Remove "max 5 methods" cap | architect | Trivial | Medium |
| 9 | Spec-coverage check post-generation | algorand | Medium | Medium |
| 10 | Escalating retry strategy | algorand | Medium | Medium |

---

## The Core Insight

Your agents aren't bottlenecked by "half-knowledge system prompts" in the sense of being wrong — the rules are actually accurate and hard-won. The bottleneck is **the opposite problem: too much always-on context**.

You've accumulated correct knowledge as ever-growing prohibition lists and examples that are ALL loaded EVERY time. This:
1. Dilutes the model's attention from the actual task
2. Burns the token budget that should go to OUTPUT (causing truncation)
3. Slows every call and raises cost

The fix isn't more rules — it's **conditional assembly**: load the right context for THIS contract, lead with positive verified examples, and give the model room to actually write the output. The error-correction system you built is excellent and should stay; it just shouldn't all fire on the first attempt.
