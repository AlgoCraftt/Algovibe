# AlgoVibe — Judging Cheat Sheet (print this)

5 min per table = **3 min present + 2 min Q&A**. Repo + live demo **already open**.

---

## 30-second opener (any panel)

> "AlgoVibe turns an English prompt into a compiled, security-audited Algorand smart contract **and** a live React dApp in minutes. A 5-agent pipeline writes the Puya contract, an external compiler produces TEAL + ARC-32, an auditor checks it, and **your own wallet** deploys it — we never hold keys. It can even generate **x402 pay-per-call APIs** where payment is the authentication."

---

## Before you sit down — open these tabs

1. GitHub repo (root)
2. `http://localhost:3000/chat` (live app)
3. `http://localhost:8000/health` (backend alive)
4. `backend/app/agents/orchestrator.py` (code walkthrough)
5. `ECOSYSTEM.md` on GitHub (renders the architecture mermaid diagrams)

## Pre-flight checklist

- [ ] Backend running (`/health` returns healthy + model + network)
- [ ] Frontend running on :3000
- [ ] Compiler reachable (`COMPILER_SERVER_URL`)
- [ ] Testnet wallet connected + funded (Pera/Defly/Lute)
- [ ] One generation already run once so you know it works today
- [ ] `backend/test_outputs/` has a recent run to show as "proof"

---

## The numbers / facts to never get wrong

- **5 agents:** Architect → Algorand contract → Security auditor → React → (compiler client is a service, not an LLM)
- **Compile retries:** max **5**, with error feedback + 3-repeat loop guard
- **Frameworks:** PuyaTS (default), PuyaPy, TealScript (legacy)
- **Deploy:** two-phase, **wallet-signed**, keys never touch server (`build_sessions.json` bridges the pause)
- **x402:** HTTP 402 → sign USDC on Algorand TestNet → facilitator (goplausible) verifies on-chain → response
- **Stack:** FastAPI + LangGraph backend; Next.js 14 / React 18 + Sandpack frontend; Docker Compose; multi-LLM + BYOK + Ollama

---

## One-liners per panel

| Panel | Lead with |
|-------|-----------|
| **Technical (30%)** | "5-agent LangGraph pipeline, external Puya compiler, deterministic + LLM security audit, automated UI↔contract wiring verifier, wallet-signed non-custodial deploy." |
| **Business (40%)** | "Algorand devs lose days wiring contracts to UIs; web devs bounce to EVM. We make it minutes. x402 pay-per-call is the why-blockchain. Beachhead = active Algorand devs." |
| **Scalability (30%)** | "Stateless API + separate stateless compiler + BYOK offloads the LLM bottleneck + AlgoNode reads with swappable indexer. No custody = no custody risk at scale." |

---

## Hard-question quick answers

- **Why blockchain not a DB+API?** → "Output *is* on-chain contracts; and x402 micropayments-as-auth literally can't exist without a chain."
- **10× users?** → "Stateless backend → horizontal scale; build sessions → Redis; compiler scales separately; LLM is elastic via BYOK; reads via AlgoNode + cache."
- **Test coverage?** → "End-to-end pipeline harness + automated wiring verifier with % UI coverage. Per-function unit tests are the honest next step."
- **Security?** → "Deterministic checks (access control, underflow, fund recovery, payment validation) + LLM audit + auto-fix-or-revert + banned-pattern sanitizer. Not a mainnet audit substitute — we say so."
- **Is RAG real?** → "Stubbed for demo speed; code exists in `backend/app/rag/`, re-enableable. We use deterministic skills + few-shots for reliability."
- **Validation?** → "Recorded end-to-end builds in `test_outputs/`; structured Algorand-dev interviews are our immediate next step." (Do real interviews before pitch!)

---

## ⚠️ Do before the event

1. **Talk to 5–10 Algorand devs**, write down quotes (Business panel asks).
2. **Put 2–3 real numbers** into the TAM table in `PANEL_2_BUSINESS.md` with named sources.
3. **Decide the live demo prompt** — a simple one that reliably compiles (e.g. "voting app" or an x402 pay-per-call API).
4. **Rehearse the 3-min script** in `PANEL_2_BUSINESS.md` §10.
5. Have a **fallback recording/screenshots** in case live demo or network fails.
