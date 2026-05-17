# AlgoVibe — Round 3 Playbook

**One document for the whole team.** Read this top-to-bottom before Round 3 work. It states what exists today, what Round 3 requires, and **exactly how to build** each gap.

| Section | Use when you need to… |
|---------|---------------------|
| [§1 Quick start](#1-quick-start-for-a-new-teammate) | Onboard in 15 minutes |
| [§2 Round 3 deliverables](#2-round-3-deliverables-checklist) | Know what to submit |
| [§3 What exists today](#3-what-exists-today-inventory) | Avoid rebuilding shipped features |
| [§4 What to build](#4-what-to-build-prioritized-backlog) | Pick tasks and implement |
| [§5 GTM pack](#5-go-to-market-pack-fill-before-submit) | Write the business submission |
| [§6 Pilots & metrics](#6-pilot-program--metrics) | Prove “tested customer base” |
| [§7 Reference](#7-reference--other-docs) | Deep technical detail |

---

## 1. Quick start (for a new teammate)

### What is AlgoVibe?

A **text-to-Algorand-dApp builder**:

1. User describes an app in natural language.
2. Backend LLM agents produce a **Puya** smart contract, compile it, and pause for **wallet-signed deploy** on testnet.
3. After deploy, frontend + hooks are generated and shown in a **Sandpack** live preview.
4. Transactions from the preview go through a **bridge** so private keys never live inside generated code.

### Run locally (5 minutes)

```bash
# Terminal 1 — backend (port 8000)
cd backend
pip install -r requirements.txt
# Create .env at repo root or backend with OPENROUTER_API_KEY or ANTHROPIC_API_KEY
# plus COMPILER_SERVER_URL pointing at your Puya compile service
uvicorn app.main:app --reload --port 8000

# Terminal 2 — frontend (port 3000)
cd frontend
npm install
# Optional: NEXT_PUBLIC_API_URL=http://localhost:8000 in frontend/.env.local
npm run dev
```

Open `http://localhost:3000/chat`, connect wallet (Pera/Defly/etc.), run a prompt, sign deploy when pipeline asks, wait for preview.

### Core user flow (must work for any demo)

```
Prompt → analyzing → generating_contract → compiling → sign_required
  → user signs app create → finalize → generating_react → complete → Sandpack preview
```

### Key files (where logic lives)

| Area | Path |
|------|------|
| Pipeline / SSE steps | `backend/app/agents/orchestrator.py` |
| Contract LLM | `backend/app/agents/algorand_agent.py` |
| React / UI LLM | `backend/app/agents/react_agent.py` |
| HTTP API | `backend/app/api/routes/generate.py` |
| Frontend state | `frontend/lib/store.ts` |
| SSE client | `frontend/lib/api.ts` |
| Preview + bridge | `frontend/components/preview/SandpackPreview.tsx`, `BridgeHandler.tsx` |
| Wallet deploy | `frontend/components/preview/DeploySignPrompt.tsx`, pipeline in `BuildAnimation.tsx` |
| System design | `ARCHITECTURE.md` |

---

## 2. Round 3 deliverables checklist

Round 3 is primarily **go-to-market + traction**, not “more features.” Use this checklist for the submission package.

### Must ship (submission blockers)

- [ ] **GTM document** (§5 template filled in) — ICP, problem, solution, pricing, distribution, 12-month roadmap
- [ ] **Traction slide** — ≥5 pilot sessions, metrics table (§6), 1–2 user quotes
- [ ] **Demo video** (2–3 min) — scripted in §6; shows prompt → sign → Lora app ID → preview interaction
- [ ] **“What we built”** — 1 page pointing to `ARCHITECTURE.md` + live testnet link or hosted URL
- [ ] **Honest gap list** — §3.2 + §4; do **not** claim features from `implementation_alignment_report.md` unless code exists

### Should ship (jury feedback — high ROI)

- [ ] **BYOK** — user brings own LLM API key (§4.1)
- [ ] **Docker self-host README** — one-command run (§4.2)
- [ ] **Public API one-pager** — curl/Postman for `/api/v1/generate` (§4.3)

### Nice to have (differentiation)

- [ ] **x402 on hosted API** (§4.4) — Agentic Commerce + monetization story
- [ ] **x402 sample dApp template** in protocol registry (§4.5)
- [ ] **OpenAPI + minimal MCP** (§4.6) — reusability score

### Do not prioritize for Round 3

- Vercel publish UI (removed from navbar; backend routes still exist)
- Extra Sandpack chrome / device toggles
- Full AVM optimizer / LocalNet sim (see `future_implementations.md` — post-hack)

---

## 3. What exists today (inventory)

### 3.1 Shipped product capabilities

| Capability | Status | Where |
|------------|--------|--------|
| NL → contract spec | ✅ | `architect.py` |
| Puya TS/Python contract gen | ✅ | `algorand_agent.py` |
| Compile via external compiler HTTP | ✅ | `compiler_client.py` |
| Self-healing compile retries | ✅ | `orchestrator.py` (`retrying` step) |
| Wallet sign app create + finalize | ✅ | `orchestrator.py`, `DeploySignPrompt`, `BuildAnimation` |
| React UI + hooks generation | ✅ | `react_agent.py` |
| Live Sandpack preview | ✅ | `SandpackPreview.tsx` |
| Parent↔iframe wallet bridge | ✅ | `BridgeHandler.tsx`, `preview-bridge-hooks.ts` |
| Chat follow-up fix frontend only | ✅ | `POST /api/v1/fix-frontend` |
| Export zip (standalone wallet) | ✅ | `ExportButton.tsx`, `export-templates.ts` |
| Protocol chips (Tinyman, etc.) | ✅ | `protocols/registry.py`, `ProtocolChips.tsx` |
| App ID → Lora link | ✅ | `sandpack-files.ts`, preview toolbar |
| Matrix build animation | ✅ | `BuildAnimation.tsx` |
| RAG | ⚠️ Stubbed | orchestrator sleeps; `rag/` not wired |
| PostgreSQL persistence | ⚠️ Optional | `db/` — build sessions use JSON file |

### 3.2 API surface (real endpoints today)

Base URL: `http://localhost:8000` (or `NEXT_PUBLIC_API_URL`)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Readiness |
| `POST` | `/api/v1/generate` | SSE pipeline until `sign_required` |
| `POST` | `/api/v1/finalize` | SSE resume after user deploys (`build_id`, `package_id`) |
| `POST` | `/api/v1/fix-frontend` | SSE patch frontend files only |
| `GET` | `/api/v1/protocols` | Ecosystem protocol list |
| `POST` | `/api/v1/publish` | Vercel publish (optional, not Round 3 focus) |

**Generate request body:**

```json
{
  "prompt": "Build a voting dApp",
  "framework": "puyats",
  "network": "testnet",
  "user_wallet": "ALGO...optional"
}
```

**SSE steps you will see:** `analyzing` → `retrieving_docs` → `generating_contract` → `compiling` → (`retrying`) → `deploying` → `sign_required` → *(user signs)* → `finalize` → `deployed` → `generating_react` → `complete` | `error`

### 3.3 Environment variables (today)

Set in repo root `.env` (loaded by `backend/app/core/config.py`):

| Variable | Required | Role |
|----------|----------|------|
| `OPENROUTER_API_KEY` **or** `ANTHROPIC_API_KEY` | Yes (one) | All LLM calls |
| `COMPILER_SERVER_URL` | Yes | Puya compile HTTP service |
| `DATABASE_URL` | No | Postgres if you enable DB features |
| `VERCEL_API_TOKEN` | No | Publish routes only |

Frontend:

| Variable | Default | Role |
|----------|---------|------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend base URL |

**There is no BYOK in the UI yet** — keys are server-side only.

### 3.4 Documented but NOT in the repo (do not pitch as done)

`implementation_alignment_report.md` describes work that is **planned or aspirational**. These paths **do not exist** in the current tree:

- `backend/app/agents/avm_optimizer.py`
- `backend/app/api/routes/compliance.py`
- `backend/app/mcp/server.py`
- `backend/docs/public_api.yaml`
- `frontend/lib/algovibe-sdk.ts`
- `frontend/components/ui/FrameworkSelector.tsx`

Treat `future_implementations.md` and `future_implementation_pro.md` as **roadmaps**, not release notes.

---

## 4. What to build (prioritized backlog)

Each item: **What** | **Why (jury/Round 3)** | **How to build** | **Acceptance criteria** | **Effort**

---

### P0-A — Pilot program & metrics

| | |
|--|--|
| **What** | Run structured user sessions and record numbers. |
| **Why** | Jury: “tested customer base”; Round 3 GTM needs traction. |
| **How** | Follow §6 exactly. |
| **Done when** | ≥5 sessions logged; ≥60% reach testnet app ID; quotes + table in GTM doc. |
| **Effort** | 2–3 days (mostly outreach, not code) |

---

### P0-B — GTM submission pack

| | |
|--|--|
| **What** | Fill §5 and export PDF/slides for judges. |
| **Why** | Round 3 explicit ask. |
| **How** | One owner; use pilot metrics; align narrative with §4.4 x402 only if built. |
| **Done when** | All §5 sections filled; 10-slide deck + 2-page executive summary. |
| **Effort** | 1–2 days |

---

### P0-C — Demo video

| | |
|--|--|
| **What** | 2–3 minute screen recording. |
| **Why** | Judges may not run your stack. |
| **How** | Script in §6 “Demo script”; test twice on clean machine. |
| **Done when** | Shows wallet connect → prompt → pipeline sign → preview button → Lora link. |
| **Effort** | 0.5 day |

---

### P1-A — BYOK (bring your own API key)

| | |
|--|--|
| **What** | User supplies OpenRouter/Anthropic key; you are not the LLM bill payer. |
| **Why** | Jury: “configurable AI model.” |
| **How to build** | |

**Option A — Session key (fastest, hackathon-safe)**

1. **Frontend** — Settings modal on `/chat`:
   - Fields: provider (`openrouter` | `anthropic`), API key (password input).
   - Store in `sessionStorage` only (never log to console in prod).
2. **Frontend** — Extend `generateDApp` / `fixFrontend` in `frontend/lib/api.ts`:
   - Add headers: `X-LLM-Provider`, `X-LLM-Api-Key` (or body field if you prefer).
3. **Backend** — `backend/app/core/llm.py`:
   - `LLMClient.from_request(provider, api_key)` — if header present, use it; else fall back to `settings`.
4. **Backend** — `generate.py` routes:
   - Read optional headers; pass into orchestrator / agents.
5. **Security copy** — UI disclaimer: “Key stays in your browser session; sent only to your self-hosted backend.”

**Option B — Server env only (already works)**

- Document in README: deploy your own backend with your `.env` keys. Counts as BYOK for self-host story but **not** for “user pastes key in product.”

| **Done when** | User can run a build with their key without changing server `.env`. |
| **Effort** | 1–2 days (Option A) |

**Files to touch:** `frontend/lib/api.ts`, new `frontend/components/settings/LlmSettings.tsx`, `backend/app/core/llm.py`, `backend/app/api/routes/generate.py`, orchestrator agent calls if they instantiate `LLMClient` globally.

---

### P1-B — Docker self-host (containerized SaaS story)

| | |
|--|--|
| **What** | `docker compose up` runs backend (+ optional frontend) with documented `.env`. |
| **Why** | Jury: “containerized SaaS framework.” |
| **How to build** | |

1. Add `docker-compose.yml` at repo root (if missing):
   - Service `backend`: build from `backend/Dockerfile`, port `8000`, env file `.env`.
   - Service `frontend`: build from `frontend/Dockerfile`, port `3000`, `NEXT_PUBLIC_API_URL=http://backend:8000`.
2. Add `backend/Dockerfile` — Python 3.11, `uvicorn app.main:app --host 0.0.0.0 --port 8000`.
3. Add `frontend/Dockerfile` — multi-stage Next.js production build.
4. Add **`SELF_HOST.md`** (short):
   - Prerequisites: Docker, compiler URL, LLM key.
   - `cp .env.example .env` → fill vars → `docker compose up --build`.
   - Open `http://localhost:3000`.
5. Wire `.github/workflows/docker-build.yml` `IMAGE_NAME` if publishing to GHCR.

| **Done when** | New machine follows `SELF_HOST.md` and completes one build. |
| **Effort** | 1 day |

**Note:** Jury “local Llama in Docker” is **optional**. BYOK + Docker satisfies most of the intent without running local models.

---

### P1-C — Public API one-pager

| | |
|--|--|
| **What** | External devs can call the engine without your UI. |
| **Why** | Reusability score (`future_implementation_pro.md`). |
| **How to build** | |

1. Create `docs/API.md`:
   - `POST /api/v1/generate` — SSE, example `curl -N`.
   - `POST /api/v1/finalize` — after deploy.
   - `POST /api/v1/fix-frontend`.
   - Event schema table (copy from §3.2).
2. Optional: Postman collection JSON in `docs/postman/`.
3. Link from README and GTM deck.

| **Done when** | Teammate runs `curl` generate from docs only. |
| **Effort** | 0.5 day |

---

### P2-A — x402 on hosted `/generate` (monetization + Agentic Commerce)

| | |
|--|--|
| **What** | Paid access to generation API via HTTP 402 + Algorand payment. |
| **Why** | Hack track “Agentic Commerce”; GTM pricing without subsidizing LLM. |
| **What is x402** | Client requests resource → server returns **402** + payment requirements → client pays on-chain → server verifies → returns resource (here: SSE stream). |
| **References** | [x402 on Algorand](https://algorand.co/agentic-commerce/x402), [dev docs](https://dev.algorand.co/resources/x402-on-algorand), [ecosystem repo](https://github.com/GoPlausible/x402-algorand-ecosystem) |

**How to build (minimal viable)**

1. **Scope** — Gate only `POST /api/v1/generate` on **hosted** deployment (env `REQUIRE_X402=true`). Self-host Docker skips payment.
2. **Middleware** — FastAPI dependency before `generate_dapp`:
   - If no valid `X-Payment` header (or cookie/session proof), return `402` JSON body with: amount, asset id (USDC/ALGO testnet), receiver address, network, expiry, request id.
3. **Facilitator** — Use ecosystem facilitator package OR verify txn yourself via algod (`pendingTransactionInfo` / indexer).
4. **Frontend** — On 402:
   - Show “Pay X to start build” modal.
   - Wallet signs payment txn; retry generate with proof header.
5. **Pricing** — Start simple: fixed ALGO per generation on testnet (e.g. 0.1 ALGO); document in GTM §5.

| **Done when** | Hosted mode rejects unpaid request; paid request runs full pipeline. |
| **Effort** | 3–5 days (integration learning curve) |

**Do not** block `finalize` or `fix-frontend` behind x402 initially — user already paid for the session.

---

### P2-B — x402 sample dApp template

| | |
|--|--|
| **What** | One protocol/template that generates a paywalled API-style dApp. |
| **Why** | “Reusable module” for ecosystem library narrative. |
| **How** | Add entry to `backend/app/protocols/registry.py` with integration prompt for x402 server pattern; demo prompt: “Build a paid API gateway on Algorand using x402.” |
| **Done when** | Demo video includes this template once. |
| **Effort** | 1–2 days (prompt + testing) |

---

### P2-C — OpenAPI + minimal MCP (reusability)

| | |
|--|--|
| **What** | Machine-readable API + MCP server wrapping compile/generate. |
| **Why** | Top 3 pivot in `future_implementation_pro.md`. |
| **How** | |

1. `backend/docs/openapi.yaml` — hand-written or `app.openapi()` export from FastAPI.
2. `backend/app/mcp/server.py` — tools: `compile_contract`, `generate_dapp` (proxy to HTTP with SSE aggregation), `list_protocols`.
3. README section “Use with Cursor / Claude Desktop” pointing to `.mcp.json`.

| **Done when** | MCP tool triggers a generate from Claude Desktop/Cursor. |
| **Effort** | 2–3 days |

**Only start after P0 + P1-A/B are done.**

---

### P3 — Post-Round 3 technical depth

From `future_implementations.md` (not required for Round 3 submission):

| Item | Summary |
|------|---------|
| AVM opcode optimizer | Detect budget errors; sub-agent refactors contract |
| ARC compliance badge | Auditor endpoint + UI |
| LocalNet simulation | Deploy + dry-run on LocalNet; “Simulated Success” badge |
| Multi-framework UI | TealScript / PyTeal toggles |
| RAG re-enable | Wire `rag/retriever.py` into orchestrator |

---

## 5. Go-to-market pack (fill before submit)

Copy this section into your submission doc or slides and **replace every bracket**.

### 5.1 One-liner

> AlgoVibe is [open infrastructure / hosted SaaS] that turns natural language into **deployed Algorand dApps** with wallet-signed deployment and live preview in under [X] minutes.

### 5.2 Problem

- Building Algorand dApps requires Puya, ARC-32, wallet flows, and frontend wiring — weeks for new teams.
- Generic AI codegen is unsafe (keys in generated code, no compile loop).
- Teams cannot self-host AI builders without vendor lock-in.

### 5.3 Solution (what exists — be honest)

| Layer | Today |
|-------|--------|
| Spec + contract + compile + retry | ✅ |
| User-signed deploy + app ID | ✅ |
| React UI + Sandpack + bridge | ✅ |
| Export + protocol integrations | ✅ |
| BYOK | [ ] P1-A |
| Docker self-host | [ ] P1-B |
| x402 payments | [ ] P2-A |
| Public MCP/SDK | [ ] P2-C |

### 5.4 Ideal customer profile (ICP)

Pick **one** primary:

- [ ] Algorand hackathon / university dev clubs  
- [ ] Indie founders prototyping on testnet  
- [ ] Web2 agencies adding Algorand for clients  

**Our choice:** _______________

### 5.5 Pricing

| Tier | Who | Price | LLM cost |
|------|-----|-------|----------|
| Self-host | Teams with DevOps | Free (MIT) + their keys | Customer |
| Hosted | Individuals / demos | [x402 per build / subscription] | Customer key OR x402 |
| Enterprise | Agencies | Custom support + Docker | Negotiated |

### 5.6 Distribution (next 90 days)

| Channel | Action | Owner | Date |
|---------|--------|-------|------|
| Algorand India / Discord | Demo + office hours | | |
| Universities | 3 pilot workshops | | |
| GitHub / DevPortal | API docs + template repo | | |
| Hackathon alumni | Case study post | | |

### 5.7 Traction (fill from §6)

| Metric | Value |
|--------|-------|
| Pilot sessions | |
| Completed deploys (app ID) | |
| Median time to app ID | |
| Repeat users | |
| Quotes | |

### 5.8 12-month roadmap

| Quarter | Milestone |
|---------|-----------|
| Q1 | Round 3, pilots, BYOK, Docker, x402 hosted |
| Q2 | MCP + SDK, ARC compliance MVP |
| Q3 | LocalNet CI, enterprise pilots |
| Q4 | Mainnet paid tier, partner integrations |

### 5.9 Competition / differentiation

| vs | AlgoVibe |
|----|----------|
| Generic AI code gen | Algorand-native compile loop + wallet deploy + bridge security |
| Manual AlgoKit | NL speed + live preview |
| Other hackathon tools | Full pipeline to **on-chain app ID**, not just TEAL files |

---

## 6. Pilot program & metrics

### 6.1 Who to recruit

- 5–10 people: mix of Algorand experience levels.
- Ideal: 2 complete beginners, 3 intermediate, 2 advanced.

### 6.2 Session script (30 min)

1. (2 min) Explain: connect wallet, one sentence prompt, sign when asked.
2. (15 min) User runs build **without you touching the keyboard**.
3. (5 min) User clicks one contract action in preview (opt-in / vote / etc.).
4. (5 min) Interview:
   - What confused you?
   - Would you use this again?
   - Would you pay [X] per build?
5. (3 min) Log metrics below.

### 6.3 Metrics table (copy per session)

| # | Date | User type | Prompt summary | Reached sign? | App ID? | Preview works? | Time (min) | Would pay? | Quote |
|---|------|-----------|----------------|---------------|---------|----------------|------------|------------|-------|
| 1 | | | | Y/N | Y/N | Y/N | | Y/N | |
| 2 | | | | | | | | | |

**Targets for a strong GTM slide:**

- ≥60% sessions get testnet **app ID**
- ≥50% interact with preview successfully
- Median time < 20 min for simple voting/token prompt

### 6.4 Demo video script (2–3 min)

| Time | Shot |
|------|------|
| 0:00 | Landing — one sentence problem |
| 0:15 | Chat — typed prompt (prepared: “Simple voting dApp, 2 candidates”) |
| 0:30 | Pipeline — matrix animation, compile logs |
| 1:00 | Sign modal — Pera/Defly approve |
| 1:30 | Contract-only / finalize — “deployed” |
| 2:00 | Live preview — click one action, wallet signs |
| 2:20 | Click App ID → Lora testnet |
| 2:40 | Export zip + “self-host / BYOK / x402” one line |
| 2:55 | Logo + GitHub |

---

## 7. Reference & other docs

| Document | Use for |
|----------|---------|
| `README.md` | Jury front door — quick start + doc index |
| `docs/SETUP.md` | Full setup, env, wallet, BYOK, simulation |
| `docs/SMART_CONTRACTS.md` | Puya, ABI, pay methods, examples |
| `docs/API.md` | HTTP/SSE API reference |
| `CONTRIBUTING.md` | Commit conventions, branch `release/round3` |
| `ARCHITECTURE.md` | Deep technical truth — pipeline, bridge, security |
| `future_implementations.md` | Post-hack technical roadmap |
| `future_implementation_pro.md` | Why reusability score matters; API/MCP strategy |
| `implementation_alignment_report.md` | **Planned** work — verify files exist before claiming |
| `ROUND3_PLAYBOOK.md` | **This file** — execution + submission |

### Hackathon vision alignment

| Track | How AlgoVibe fits |
|-------|-------------------|
| Future of Finance | Fast testnet DeFi/voting/ASA prototypes + export |
| Agentic Commerce | x402-gated API (P2-A); agent pipeline today |
| RegTech | Future ARC compliance (P3) |

### Is this one document enough?

| Goal | Enough? |
|------|---------|
| Understand product + run locally | ✅ §1, §3 |
| Know what to submit for Round 3 | ✅ §2, §5, §6 |
| Implement jury feedback | ✅ §4 (step-by-step) |
| Deep compiler/bridge debugging | ⚠️ Also read `ARCHITECTURE.md` |
| Implement x402 / MCP in full | ✅ §4.4–4.6 + external x402 docs |

**Owner assignments:** At kickoff, assign each §4 item an owner and deadline in your team tracker.

---

*Last updated: May 2026 — update §3.2 if API routes change.*
