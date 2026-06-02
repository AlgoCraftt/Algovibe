# AlgoCraft / AlgoVibe — 7-Day Battle Plan to Crack Top 10

> **Mentor mode: harsh, specific, no flattery.** This is built from your *actual code* (the cloned `Algovibe` repo), the judging rubric (`judging.txt`), and the semifinal format (`mail.txt`). Current standing: **Rank 14, weighted 56.2**. Top-10 line today is **57.7**, and it rises to **~62-63 if everyone preps**. So your real target is **62+**, not 58. Plan accordingly.

> **Reality check on "no matter what":** nothing guarantees top 10. Half the field can fix their business narrative in a week, which compresses scores and raises the cutoff. This plan maximizes your *expected* finish. Execute all of P0 + P1 and you go from bubble to likely-in. Skip them and you're betting on other teams being lazy.

---

## 0. The One Thing That Can Sink You (fix in the first 24 hours)

**Your code contains a self-incriminating fake.** `backend/app/agents/orchestrator.py`:

```python
# FAKE RAG for demo speed, logs make it look real
await asyncio.sleep(1.5) # Simulate RAG work
docs = [] # Disconnected
```

You market "RAG-Powered Intelligence" as a headline feature. A technical judge doing a 5-10 min walkthrough **will** find this, and the comment `logs make it look real` reads as intent to deceive. That doesn't just zero your RAG credit — it poisons trust at the Business and Scalability tables too ("what else is faked?").

**This is non-negotiable. It must be genuinely wired or honestly removed before any judge sees the repo.** Good news: you already built the real system. See P0.1.

---

## Scoring math (why this plan is ordered the way it is)

Weighted total = **0.30·Technical + 0.40·Business + 0.30·Scalability**.

| Lever | Effort | Panel | Pts on panel | Weighted gain |
|---|---|---|---|---|
| Wire real RAG (kills the fake) | ~1 day | Tech | +6 and removes trust-bomb | ~+1.8 |
| Reposition as **x402 / agentic-commerce dApp generator** | ~2 days | Business + Scale | +8 Biz, +6 Scale | ~+5.0 |
| Add real test suite | ~1.5 days | Tech | +8 | ~+2.4 |
| Sharpen Business deck (TAM/revenue/GTM) | ~1 day | Business | +6 | ~+2.4 |
| Deploy 3 showcase dApps w/ live App IDs | ~0.5 day | Tech + Scale | +3 each | ~+1.8 |

Business is 40%. **A point of narrative is worth more than a point of code.** That's not how you wish it worked, but it's the rubric. Lead with it.

---

## P0 — DO FIRST (Days 1-2). Removes liabilities, cheap points.

### P0.1 — Make RAG real (or delete the claim). ~1 day.
You have everything already:
- `backend/app/rag/retriever.py` — complete: ChromaDB routing, `get_fallback_docs()`, solid PuyaPy/PuyaTs/SDK fallback docs.
- `backend/app/rag/embeddings.py` — working local sentence-transformers.
- `backend/scripts/index_algorand_docs.py` — the indexer.
- `backend/knowledge/algorand-agent-skills/` — a real, rich corpus (incl. x402, ARC standards, testing).

**Minimum viable fix (do this even if you do nothing else):** in `orchestrator.py`, replace the two faked nodes with real calls. Even with ChromaDB empty, `retrieve_docs()` returns the curated fallback docs — which are *actually useful* and *real*.

```python
# retrieve_contract_docs_node
from app.rag.retriever import retrieve_docs
from app.core.config import settings
docs = await retrieve_docs(query=state["prompt"], framework=state["framework"], top_k=settings.rag_top_k)
state["contract_docs"] = docs
```
```python
# retrieve_sdk_docs_node
docs = await retrieve_docs(query=state["prompt"], framework="puyats", top_k=settings.rag_top_k)
state["sdk_docs"] = docs
```
Delete every `# FAKE RAG` / `logs make it look real` comment and the `asyncio.sleep(1.5)`.

**Full version (if time):** run `index_algorand_docs.py` to index the `algorand-agent-skills` corpus into ChromaDB, commit the `chroma_db` (or document a one-command build), so the demo shows true semantic retrieval over the x402/ARC skill files. Now "RAG-powered" is defensible under questioning.

**Confirm it actually feeds generation:** `generate_contract_node` already passes `docs_context=state["contract_docs"]` into the agent — so once docs are non-empty, retrieval genuinely improves output. Be ready to show that in the walkthrough.

### P0.2 — Remove the latent crash. ~15 min.
`generate_contract_node` does `from test_dapp import HARDCODED_CONTRACT` when prompt is `debug`/`test`. That module doesn't exist → `ImportError`. Either add the file or delete the debug branch. A judge typing "test" should not crash your product.

### P0.3 — Fix the SSE flush bug you already documented. ~30 min.
Your own `ARCHITECTURE.md` admits the final `complete` event can be dropped if it arrives without a trailing newline ("stuck at deploying"). In `frontend/lib/api.ts`, flush the remaining `buffer` after the read loop ends. A demo that hangs on "deploying" in front of a judge is a disaster. Kill it now.

---

## P1 — THE BIG MOVE (Days 2-4): Reposition as the agentic-commerce / x402 dApp generator.

**This is what actually lifts you, and it's mostly positioning + one feature.** Right now you pitch "text → voting app." That's a dev toy with a TAM of "a few thousand Algorand devs" and no clean "why blockchain." It's why your Business sits at 54 and why I told your competitor you have a hard ceiling. **Break the ceiling by aiming the exact same engine at the cohort's dominant theme.**

The entire hackathon is built around **Agentic Commerce + x402** (AlgoBharat's thesis; McKinsey's $3-5T agentic-commerce projection). You already have **x402 skill docs** in your knowledge base. So:

### P1.1 — Add x402 / agentic-commerce generation templates. ~2 days.
Teach the engine to generate **x402-enabled** dApps and agent endpoints, not just CRUD contracts. Concretely:
- Extend `architect.py`: add categories `x402_service`, `agent_payment`, `pay_per_call_api` to the allowed `template_type` list, and add a golden example spec for an x402-gated service (a contract/endpoint that requires payment before returning a resource).
- Extend `algorand_agent.py`: add a framework-aware golden skeleton + few-shot for an x402 flow, drawing from your `knowledge/.../algorand-x402-typescript` and `algorand-x402-python` skills (feed them via RAG so it's not hardcoded).
- Demo prompt that wins the room: **"Build a pay-per-call weather API that charges 0.01 USDC per request using x402."** → it generates the contract + the x402 server middleware + a React client that pays and retries. That is the single most on-thesis demo you can show at this event.

**Why this is the highest-leverage feature:** it converts you from "a dev tool" into "the fastest way to ship the exact thing this hackathon is about." It gives Business a real "why blockchain" (agents need on-chain micropayments), aligns you with the sponsor's roadmap, and most single-product teams **cannot** add this in a week. You can, because the knowledge is already in your repo.

### P1.2 — Do NOT rewrite the architecture.
You asked whether to change the architecture pattern. **No. Absolutely not.** Your two-phase wallet-signed deploy + Sandpack iframe bridge is genuinely good engineering and it's your highest-scoring asset (Tech 62 is mostly this). A rewrite in 7 days = broken demo = dead. **Add the x402 capability on top of the existing pipeline. Refactor nothing structural.** Discipline here is the difference between top 10 and a crash.

### P1.3 — Lift the contract-complexity ceiling *carefully*.
`architect.py` caps contracts at "3-5 methods, keep it SIMPLE." That's why reviewers say "only simple contracts." Don't blow this open (reliability is your moat) — but allow one tier up for the x402/escrow templates specifically, with the golden skeletons doing the heavy lifting so the LLM stays on rails. Reliability of a slightly-richer template beats ambition that fails to compile live.

---

## P2 — TECHNICAL CREDIBILITY (Days 3-5)

### P2.1 — Write a real test suite. ~1.5 days. (`judging.txt`: "even 50% beats zero.")
`pytest`/`pytest-asyncio` are already in `requirements.txt`. Create `backend/tests/`:
- `test_architect.py` — feed 5 prompts (voting, crowdfunding, x402 service, nft, escrow), assert valid JSON spec, `template_type` in the allowed set, ≥1 method, has a getter.
- `test_sanitizer.py` — unit-test `_sanitize_code` in `algorand_agent.py` (the banned-pattern / opt-in regex fixes). This is pure, fast, deterministic — easiest coverage you'll ever get.
- `test_abi_resolution.py` — port the ARC-32 `onComplete` resolution logic (`abi-tx.ts`) and test NoOp vs OptIn decisions.
- `test_retriever.py` — assert `retrieve_docs()` returns non-empty for each framework (proves RAG is wired — doubles as evidence against the "fake" accusation).
- Add a GitHub Actions workflow that runs them. A green CI badge is cheap, visible credibility.

Target a *visible* coverage number. 40-50% on the backend is plenty to say "we test" with a straight face.

### P2.2 — Deploy 3 showcase dApps to testnet. ~0.5 day.
Pre-generate and deploy: (1) the x402 pay-per-call service, (2) a crowdfunding app, (3) a DAO vote. Put their **live App IDs + Lora explorer links** in the README and on a slide. Concrete, clickable, verifiable beats any claim. It also de-risks the live demo (you have a known-good fallback if the wifi/LLM flakes).

### P2.3 — Re-enable simulation honesty.
You have `dapp_simulator.py` + `simulate_enabled`. If it works, show it. If it's flaky, say "post-deploy happy-path simulation, best-effort" — don't oversell. Judges reward calibrated honesty (`judging.txt` literally says so).

---

## P3 — WIN THE BUSINESS TABLE (Days 4-6). This is 40%. Treat it like the final.

You are an engineer who under-sells. Fix that. Here's the script.

### P3.1 — The repositioned pitch (memorize the one-liner)
> **"AlgoVibe is the fastest way to ship agentic-commerce apps on Algorand — describe an x402 pay-per-call service in plain English and get a deployed contract, a paying client, and a live dApp in under three minutes."**

Not "text to dApp." That's a toy. The above is a shovel in a gold rush.

### P3.2 — Problem (1 sentence, quantified)
"Every team at this hackathon spent days fighting Puya/TEAL boilerplate and x402 wiring before writing a line of business logic. Agentic commerce is projected by McKinsey to mediate **$3-5T** of commerce by 2030 — but the builder funnel onto Algorand is the bottleneck." You ARE the funnel. (Source the McKinsey figure on the slide.)

### P3.3 — "Why blockchain?" (they WILL ask; have the kill-shot ready)
Weak answer (current): "we generate Algorand contracts." A judge eats that alive — a codegen tool isn't inherently on-chain.
Strong answer (new): "We don't just generate code — we generate **on-chain settlement primitives**. Our x402 templates produce contracts where AI agents pay each other in USDC with instant finality and sub-cent fees. That payment rail is impossible on a Web2 stack — there's no per-call micropayment without a chain. We're the tool that makes Algorand the default chain for agentic commerce." That reframes you from "tool" to "ecosystem growth engine," which is exactly what the sponsor funds.

### P3.4 — TAM (conservative, sourced, layered — `judging.txt` warns against overselling)
- **SAM now:** Algorand/AlgoKit developers + every hackathon/grant cohort AlgoBharat runs (concrete, you can name them).
- **TAM expansion:** the engine is chain-agnostic (it was Move/OneMove before Puya — say this; it proves extensibility). "Land on Algorand, expand to every AVM/EVM chain that needs an onboarding funnel."
- Frame it as "first 0.1% of a fast-growing builder base," not "1% of all developers." Conservative reads as credible.

### P3.5 — Revenue model (have a real one)
- **Free / BYOK** (your own API key) — adoption flywheel.
- **Hosted Pro** ($/mo) — managed LLM + compiler + one-click Vercel deploy, no setup.
- **Team / Enterprise** — private deployment of the **whole AlgoCraft suite** (hub + AlgoFlow + IDE + compiler) for ecosystems/chains that want a branded builder funnel. This is the venture-scale line.
- **Template marketplace** — take a cut on premium x402/DeFi templates.

### P3.6 — USE THE SUITE. This is your unfair advantage and you're hiding it.
Your `ECOSYSTEM.md` shows AlgoCraft is **5 repos**: marketing hub + **AlgoFlow** (visual builder) + **Algorand IDE** (Monaco/WebContainer) + **compilerserver** + AlgoVibe. **Most teams are one half-built repo. You have a product suite with a shared compiler.** Pitch it as a funnel: "Natural language (AlgoVibe) → visual blocks (AlgoFlow) → full IDE (AlgoCraft IDE), all on one compiler backend. Three on-ramps for three skill levels." This single slide lifts Business (it's a platform, not a feature), Scalability (shared infra, defensible), and Team Capability (you shipped *five* things). A solo/duo team that built a suite is a strong founder signal — say it out loud.

### P3.7 — First-100-users plan (specific, not "go viral")
- 30: AlgoBharat Hack Series participants + Discord (you're literally in the room with them).
- 20: university blockchain clubs in India (run a "build an Algorand dApp in 5 min" workshop using AlgoVibe).
- 25: AlgoKit / Algorand Foundation developer relations — pitch it as official onboarding tooling.
- 25: x402 / agentic-commerce builders via the GoPlausible / x402 community.
Name the channels. Judges reward specificity.

---

## P4 — SCALABILITY TABLE (Day 6). Have crisp answers.

- **10x users:** stateless FastAPI workers behind a queue; LLM + compiler are the bottlenecks → BYOK offloads LLM cost to users; compiler server scales horizontally (it's already a separate Docker service — show the `docker-compose`).
- **Replace `build_sessions.json` with Redis/Postgres** for the build store (you already flagged this in `ARCHITECTURE.md` limitations — say "known, here's the migration"). Owning your limitations scores points.
- **Indexer/data strategy:** you read chain state via algod/indexer (algonode) — name your fallback if algonode rate-limits (run your own indexer / Nodely). Judges specifically probe this.
- **Cost:** rough monthly cloud number (LLM via BYOK = near-zero variable cost to you; compiler + frontend hosting = modest). Have the figure.
- **Third-party risk:** OpenRouter/Anthropic, algonode, compiler server, Vercel. State each + the fallback. The Ollama local-LLM path is a great answer to "what if your LLM provider dies."

---

## 7-Day Schedule (2 people)

| Day | Person A (backend/contracts) | Person B (frontend/pitch) |
|---|---|---|
| 1 | P0.1 wire real RAG; P0.2 crash fix | P0.3 SSE flush fix; start deck skeleton |
| 2 | P1.1 x402 architect+agent templates | Build the x402 demo UI flow |
| 3 | P1.1 finish; P1.3 complexity tier | P2.2 deploy 3 showcase dApps, capture App IDs |
| 4 | P2.1 tests (architect, sanitizer, retriever) | P3 deck: problem/why-blockchain/TAM |
| 5 | P2.1 tests + CI; index RAG corpus (full) | P3 deck: revenue/GTM/suite slide |
| 6 | P4 scalability answers; harden demo | Rehearse all 3 tables, time to 3 min each |
| 7 | Freeze code. Two clean dry-runs. Prep Q&A. | Two clean dry-runs. Prep Q&A. |

**Day 7 rule: no new features.** Stabilize and rehearse. A feature half-added on Day 7 is how you turn a top-10 demo into a crash.

---

## The Demo Script (3 min — same flow at every table, emphasis shifts)

1. **(20s) Hook:** "This hackathon is about agentic commerce. Watch me ship an x402 pay-per-call service in one prompt." Don't explain the architecture yet — show the magic first.
2. **(60s) Live build:** type the x402 prompt → narrate the agent pipeline (architect → RAG retrieves x402 skills → contract → self-healing compile → wallet sign → live preview). The self-healing compile retry is a genuine "wow" — call it out.
3. **(40s) Proof:** click the deployed App ID on Lora; in the preview, make the client pay USDC and get the resource. Real on-chain, real x402.
4. **(30s) The platform:** one slide — the 5-repo suite funnel. "Three on-ramps, one compiler."
5. **(30s) Close, table-specific:** Tech → "and here's our test suite + real RAG, open the repo." Business → "$3-5T agentic commerce, here's our revenue model." Scale → "shared compiler infra, BYOK economics, here's first-100."

---

## Q&A Landmines (they WILL hit these — script the answers)

- **"Show me where RAG actually runs."** → open `orchestrator.py` + `retriever.py`, show non-empty docs feeding generation. (If you didn't do P0.1, do NOT invite this. But do P0.1.)
- **"Isn't this just a code generator? Why does it need a blockchain?"** → the x402/on-chain-settlement answer from P3.3.
- **"What's your test coverage?"** → "~45% backend, CI runs on every push" + show the badge. ("Zero" loses; a real number wins.)
- **"What happens at 10x load?"** → P4 answer. Don't freeze.
- **"Who's your customer — be specific, not 'everyone.'"** → "Hackathon + grant cohorts, uni clubs, x402 builders" (P3.7). Never say "all developers."
- **"What can't it do yet?"** → be honest: "complex multi-contract systems, mainnet hardening, and we cap contract complexity for reliability — that's a deliberate tradeoff." Calibrated honesty scores (`judging.txt`).
- **"It was Move before Algorand?"** (if they read ECOSYSTEM.md) → "Yes — proof the engine is chain-agnostic. We focused it on Algorand/Puya for this thesis; the architecture ports." Turn the doc 'inconsistency' into an extensibility flex.

---

## Brutal closing truths

1. **You under-sell catastrophically.** You built a 5-repo suite with a self-healing compiler and a secure iframe bridge, and you pitched it as "make a voting app." Your engineering is top-8 material; your *story* is rank-14. Fix the story and you move more than any code change can.
2. **The fake RAG is an unforced error that can end your run.** It's the only thing in your repo that attacks your integrity. Kill it first. You already own the real version — there's no excuse.
3. **Discipline beats ambition this week.** Don't rewrite the architecture. Don't blow open contract complexity. Add x402, wire RAG, write tests, nail the pitch, rehearse twice. That's it.
4. **Top 10 is not guaranteed and I won't pretend it is.** But this plan targets ~64-66 weighted in a competitive field, which clears the rising cutoff with margin. Execute P0+P1+P3 fully; P2+P4 are the insurance.

Now go. Day 1 is the RAG fix. Don't open the deck until the fake is dead.




what to do
Yes. And let me be precise about *what* you add and *why* — because there are two different things people mean by "add x402" and only one of them actually moves your score.

## What you're NOT doing (don't do this)

Don't bolt an x402 paywall onto AlgoVibe itself (like "pay 0.01 USDC per dApp generation"). That would be:
- Forced and unnatural — nobody's paying to use a hackathon tool
- A friction barrier for the judges trying your demo
- A weak "why blockchain" (you could just use Stripe)

## What you ARE doing (this is the move)

**Teach your engine to *generate* x402-enabled dApps as output.** Your product is a dApp factory. Right now it generates voting apps, crowdfunding apps, counters. You add x402 as a *generation target* — so when someone types:

> "Build a pay-per-call weather API that charges 0.005 USDC per request using x402"

...your pipeline outputs a working x402-gated Algorand contract + the client payment code + a React frontend that demonstrates the pay-and-retry flow. Deployed to testnet in under 3 minutes.

This is the strategic unlock because it solves three judging problems simultaneously:

**1. Business — "Why blockchain?"** (the question that currently kills you)
> "We're not just a codegen tool — we generate on-chain settlement primitives. Our x402 templates produce contracts where AI agents pay each other in USDC with instant finality and sub-cent fees. That micropayment rail is impossible without a chain. We're the tool that makes Algorand the default infrastructure for agentic commerce."

That's a "why blockchain" answer that no judge can punch a hole in. You don't have one right now.

**2. Business — TAM expansion beyond "Algorand devs"**
Your TAM stops being "a few thousand Algorand developers" and becomes "every builder shipping agentic-commerce products" — the exact thesis AlgoBharat is funding. You're the onramp. McKinsey's $3-5T projection becomes your TAM anchor.

**3. Technical — proof your engine handles real-world complexity**
A x402 template is harder than a counter or a voting app. It proves the self-healing compile loop, the RAG (which should be pulling your existing `algorand-x402-typescript` and `algorand-x402-python` skills), and the two-phase deploy work on non-trivial contracts.

## What it takes (concretely, in your code)

1. **`architect.py`** — add `x402_service` and `pay_per_call` to the `template_type` list + add a golden example spec (like the crowdfunding one you already have, but for an x402-gated endpoint).

2. **`algorand_agent.py`** — add a few-shot example / golden skeleton for x402 contract generation. Your RAG already has the full x402 skill docs in `knowledge/algorand-agent-skills/skills/algorand-x402-typescript/` — once RAG is wired (P0.1 from the battle plan), those feed into context automatically.

3. **`react_agent.py`** — teach it to generate a client-side `wrapFetchWithPayment` flow (the standard x402 client pattern) in the React preview.

4. **One pre-baked showcase** — deploy the generated x402 dApp to testnet, grab the App ID, put it in your README with an explorer link. This is your "proof" slide.

That's it. ~2 days of work. You're not building x402 infrastructure (that's what AlgoPay Toolkit does). You're building the tool that lets *anyone* ship x402 apps without understanding the protocol — which is arguably more valuable.

## The pitch line (memorize this)

> "Every team here spent a week fighting x402 boilerplate. With AlgoVibe, that's one prompt and three minutes. We're not competing with them — we're the tool that makes all of them ship faster."

That positions you as complementary to the ecosystem rather than competing in it, which is exactly what the sponsor (AlgoBharat) wants to fund — growth infrastructure.

So yes: add x402. But as a generation capability, not as a monetization mechanism for your own product. The distinction is everything.