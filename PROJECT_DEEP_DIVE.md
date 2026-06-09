# AlgoVibe — Complete Project Context

> **Purpose of this file:** This single document contains everything needed for any LLM or human to fully understand the AlgoVibe project — what it does, how Algorand works, what packages are used, how data flows, and how every component connects. Read this once and you can answer any question about the project.

---

## 📌 What AlgoVibe Is

AlgoVibe is an **AI-powered dApp generator for the Algorand blockchain**. A user describes an application in plain English, and AlgoVibe:

1. Writes a smart contract (in PuyaTS or PuyaPy)
2. Compiles it to TEAL bytecode
3. Audits it for security vulnerabilities
4. Deploys it to Algorand TestNet
5. Generates a complete React frontend with typed contract bindings
6. Optionally publishes it to Vercel (one-click)

It also implements the **x402 protocol** — HTTP-native pay-per-call API monetization settled on-chain.

---

## 🌐 The Algorand Ecosystem (How It All Fits)

### What Algorand Is

Algorand is a **Layer-1 proof-of-stake blockchain** created by MIT cryptographer Silvio Micali. Key properties:

- **Pure Proof-of-Stake (PPoS):** Every ALGO holder can participate in consensus. No mining, no energy waste.
- **Instant finality:** Transactions are final in ~3.3 seconds. No "6 confirmations" — once it's in a block, it's permanent.
- **Low fees:** Standard transaction fee is 0.001 ALGO (~$0.0002).
- **AVM (Algorand Virtual Machine):** Executes smart contract bytecode (TEAL). Supports stateful applications with global/local storage.
- **Atomic transactions:** Group up to 16 transactions — all succeed or all fail. No reentrancy attacks.
- **ASAs (Algorand Standard Assets):** Create tokens without writing a contract. USDC on Algorand is an ASA (ID: 10458941 on TestNet).

### Algorand's Account Model

```
┌─────────────────────────────────────────────────────────────┐
│  ALGORAND ACCOUNT                                            │
├─────────────────────────────────────────────────────────────┤
│  Address:    58-character string (base32-encoded public key) │
│  Balance:    ALGO (native) + opted-in ASAs                   │
│  Auth:       Ed25519 private key signs transactions          │
│  Min Balance: 0.1 ALGO + 0.1 per ASA + storage costs         │
│  Apps:       Can create and interact with smart contracts     │
└─────────────────────────────────────────────────────────────┘
```

### How Smart Contracts Work on Algorand

Unlike Ethereum (one program = one deployment), Algorand contracts have:

- **Application ID:** Unique integer identifying the deployed contract
- **Application Address:** Derived from the App ID — the contract's "bank account"
- **Approval Program:** TEAL bytecode that runs on every call (decides accept/reject)
- **Clear Program:** TEAL that runs when a user opts out
- **Global State:** Key-value storage shared across all users (up to 64 entries)
- **Local State:** Per-user storage (requires opt-in, up to 16 entries per user)
- **Box Storage:** Larger key-value data (for maps, lists, complex structures)
- **Inner Transactions:** The contract can send transactions itself (payments, ASA transfers, calls to other contracts)

### Transaction Types

| Type | What it does |
|------|--------------|
| `pay` | Send ALGO from one account to another |
| `axfer` | Transfer an ASA (custom token) |
| `appl` | Call a smart contract method (Application Call) |
| `acfg` | Create/configure an ASA |
| `keyreg` | Register for consensus participation |

### ARC Standards Used

| Standard | What it defines |
|----------|-----------------|
| **ARC-4** | ABI for smart contracts (method selectors, argument encoding) |
| **ARC-32** | Application specification (JSON describing the full contract interface) |
| **ARC-56** | Extended app spec (newer, superset of ARC-32) |

### Contract Languages

| Language | Description | Used in AlgoVibe |
|----------|-------------|------------------|
| **TEAL** | Low-level stack-based bytecode (what the AVM executes) | Compilation target |
| **PuyaTS** | TypeScript-like high-level language → compiles to TEAL | Primary (default) |
| **PuyaPy** | Python-like high-level language → compiles to TEAL | Secondary option |

### Network Topology

```
User Wallet (Pera/Defly)
       │
       ▼ signs transactions
Algod Node (testnet-api.algonode.cloud)
       │
       ▼ propagates to network
Algorand Consensus (TestNet)
       │
       ▼ confirmed in ~3.3s
Indexer (testnet-idx.algonode.cloud)
       │
       ▼ queryable history
```

---

## 🏗️ System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              AlgoVibe System                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────┐     ┌──────────────────┐     ┌───────────────────────────┐  │
│  │  FRONTEND   │────▶│    BACKEND        │────▶│  EXTERNAL SERVICES        │  │
│  │  Next.js 14 │◀────│    FastAPI/Python  │◀────│                           │  │
│  │  Port 3000  │     │    Port 8000      │     │  • Compiler Server        │  │
│  │             │     │                    │     │  • Algorand TestNet Node  │  │
│  │  • UI/Chat  │     │  • LLM Agents     │     │  • Algorand Indexer       │  │
│  │  • Sandpack │     │  • Pipeline        │     │  • LLM Provider           │  │
│  │  • Wallet   │     │  • x402 Proxy     │     │  • x402 Facilitator       │  │
│  │  • Bridge   │     │  • Publish         │     │                           │  │
│  └─────────────┘     └──────────────────┘     └───────────────────────────┘  │
│         │                                                                     │
│         ▼                                                                     │
│  ┌─────────────┐                                                             │
│  │ x402 SERVER │  Hono + @x402 middleware (optional, for x402 demos)          │
│  │ Port 4021   │                                                             │
│  └─────────────┘                                                             │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚙️ The Generation Pipeline

### Overview

```
User Prompt ──▶ Architect ──▶ AlgorandAgent ──▶ Compiler ──▶ Auditor ──▶ Deploy ──▶ ReactAgent
                (LLM)          (LLM)           (Remote)     (LLM+rules)  (Wallet)   (LLM)
```

### Detailed Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PIPELINE STATE MACHINE (LangGraph)                         │
│                    backend/app/agents/orchestrator.py                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. ANALYZE ──────────────────────────────────────────────────────────────   │
│     │  Agent: architect.py                                                   │
│     │  Input: "Build a voting app with 3 candidates"                         │
│     │  Output: JSON spec with methods, state, types, template_type           │
│     │                                                                        │
│  2. RETRIEVE DOCS ────────────────────────────────────────────────────────   │
│     │  RAG retrieval of Algorand/PuyaTS documentation (when enabled)         │
│     │                                                                        │
│  3. GENERATE CONTRACT ────────────────────────────────────────────────────   │
│     │  Agent: algorand_agent.py                                              │
│     │  Input: spec + docs + framework choice                                 │
│     │  Output: PuyaTS source code (TypeScript-like Algorand contract)        │
│     │                                                                        │
│  4. COMPILE ──────────────────────────────────────────────────────────────   │
│     │  Service: compiler_client.py → remote compiler server                  │
│     │  Input: PuyaTS source code                                             │
│     │  Output: approval TEAL + clear TEAL + ARC-32 JSON spec                 │
│     │                                                                        │
│     │  ← If compile fails: retry up to 5 times (error fed back to LLM)      │
│     │                                                                        │
│  5. SECURITY AUDIT ───────────────────────────────────────────────────────   │
│     │  Agent: security_auditor.py                                            │
│     │  Layer 1: Deterministic pattern matching (no LLM, instant)             │
│     │  Layer 2: LLM deep review (for financial contracts only)               │
│     │  Output: findings (critical/warning/info)                              │
│     │                                                                        │
│     │  ← If criticals found: regenerate once with findings as context        │
│     │                                                                        │
│  6. SIGN & DEPLOY ────────────────────────────────────────────────────────   │
│     │  Emits "sign_required" event to frontend                               │
│     │  User's wallet signs the deploy transaction                            │
│     │  Contract goes live on TestNet (gets an App ID)                        │
│     │                                                                        │
│  7. GENERATE FRONTEND ────────────────────────────────────────────────────   │
│     │  Agent: react_agent.py                                                 │
│     │  Input: ARC-32 spec + contract spec + App ID                           │
│     │  Output: App.tsx + useContract.ts + useAlgorand.ts + CSS               │
│     │                                                                        │
│  8. PATH VERIFICATION ────────────────────────────────────────────────────   │
│     │  Service: dapp_path_verifier.py + dapp_path_repair.py                  │
│     │  Checks: every UI button → hook → contract method is wired             │
│     │  Repairs: auto-fixes broken imports, missing methods                   │
│     │                                                                        │
│  9. COMPLETE ─────────────────────────────────────────────────────────────   │
│        Files loaded into Sandpack preview → user can interact                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🌉 The Bridge Protocol (Iframe ↔ Blockchain)

Generated code runs in a **sandboxed Sandpack iframe** (hosted on `codesandbox.io`). It has NO access to the user's wallet. All blockchain operations are delegated to the parent window via `postMessage`.

```
┌─────────────────────────────────┐         ┌─────────────────────────────────────┐
│       SANDPACK IFRAME            │         │          PARENT WINDOW               │
│   (generated React app)          │         │      (Next.js + wallet)              │
│                                  │         │                                      │
│  useContract().vote(1)           │         │  BridgeHandler.tsx                   │
│       │                          │         │       │                              │
│       ▼                          │  post   │       ▼                              │
│  window.parent.postMessage({     │ Message │  addEventListener('message', ...)    │
│    id: "abc123",                 │────────▶│                                      │
│    type: "CALL_METHOD",          │         │  1. Build txn (algosdk)              │
│    payload: {                    │         │  2. Sign (wallet popup)              │
│      method: "vote",             │         │  3. Submit to Algorand node          │
│      args: [1],                  │         │  4. Wait for confirmation            │
│      appId: 763896205            │         │  5. Return result                    │
│    }                             │         │       │                              │
│  })                              │◀────────│       ▼                              │
│                                  │ response│  source.postMessage({                │
│  // receives: { txId, success }  │         │    id: "abc123",                     │
│                                  │         │    type: "ALGOCRAFT_RESPONSE",       │
│                                  │         │    result: { txId: "KH75..." }       │
│                                  │         │  })                                  │
└─────────────────────────────────┘         └─────────────────────────────────────┘
```

### Message Types

| Message | Direction | Purpose |
|---------|-----------|---------|
| `GET_ADDRESS` | iframe → parent | Get connected wallet address |
| `CALL_METHOD` | iframe → parent | Execute a contract method (may include payment) |
| `READ_STATE` | iframe → parent | Read on-chain global/local state |
| `OPT_IN` | iframe → parent | Opt user into the contract (local state) |
| `X402_FETCH` | iframe → parent → backend | Full x402 paid API call |
| `SIGN_X402_PAYMENT` | iframe → parent | Sign an x402 payment proof |
| `ALGOCRAFT_RESPONSE` | parent → iframe | Return result/error |
| `ALGOCRAFT_EVENT` | parent → iframe | Notify wallet change |

### How Atomic Groups Work (Payment + Method Call)

When a contract method requires payment (e.g. `record_payment`):

```typescript
// Bridge builds two transactions:
const payTxn = makePaymentTxnWithSuggestedParamsFromObject({
  sender: userAddress,
  receiver: getApplicationAddress(appId),  // contract's address
  amount: 10000,  // microALGO
})

const appTxn = makeApplicationCallTxnFromObject({
  sender: userAddress,
  appIndex: appId,
  appArgs: [methodSelector],  // ABI method ID
})

// Group them — BOTH must succeed or BOTH revert
assignGroupID([payTxn, appTxn])

// Contract verifies via: gtxn[0].receiver === currentApplicationAddress
// Contract verifies via: gtxn[0].amount >= pricePerCall
```

---

## 💰 x402 Protocol Implementation

### What x402 Is

x402 uses **HTTP 402 Payment Required** (a real HTTP status code) to gate API access behind blockchain payments. No API keys, no OAuth, no subscriptions — **payment is the authentication**.

### The Protocol Flow

```
┌──────────┐                    ┌──────────────┐                 ┌────────────────┐
│  CLIENT  │                    │  x402 SERVER │                 │  FACILITATOR   │
│ (@x402/  │                    │  (Hono +     │                 │  (goplausible) │
│  fetch)  │                    │   @x402/hono)│                 │                │
│          │                    │              │                 │                │
│  GET /api/data ──────────────▶│              │                 │                │
│          │                    │              │                 │                │
│          │◀─── HTTP 402 ──────│  Middleware  │                 │                │
│          │  PAYMENT-REQUIRED: │  returns     │                 │                │
│          │  base64({          │  payment     │                 │                │
│          │    accepts: [{     │  requirements│                 │                │
│          │      price: $0.01, │              │                 │                │
│          │      payTo: "GO5.."│              │                 │                │
│          │      asset: USDC,  │              │                 │                │
│          │      network: algo │              │                 │                │
│          │    }]              │              │                 │                │
│          │  })                │              │                 │                │
│          │                    │              │                 │                │
│  1. Parse requirements        │              │                 │                │
│  2. Build USDC transfer txn   │              │                 │                │
│  3. Sign with private key     │              │                 │                │
│          │                    │              │                 │                │
│  GET /api/data ──────────────▶│              │                 │                │
│  X-PAYMENT: base64(signedTx)  │              │                 │                │
│          │                    │── verify ───────────────────▶ │                │
│          │                    │              │  Check on-chain: │                │
│          │                    │              │  was USDC sent?  │                │
│          │                    │              │  correct amount? │                │
│          │                    │              │  correct payTo?  │                │
│          │                    │◀── ✓ valid ────────────────── │                │
│          │                    │              │                 │                │
│          │◀─── HTTP 200 ──────│  Serve real  │                 │                │
│          │  { data: ... }     │  content     │                 │                │
└──────────┘                    └──────────────┘                 └────────────────┘
```

### AlgoVibe's x402 Architecture

```
Preview iframe
    │
    │ postMessage('X402_FETCH', { url: 'http://localhost:4021/api/data' })
    ▼
BridgeHandler (parent window, localhost:3000)
    │
    │ POST /api/v1/x402-proxy { url, method }
    ▼
Backend x402_proxy.py (localhost:8000)
    │
    │ Spawns: tsx _x402_run_<uuid>.ts
    │ Env: X402_MNEMONIC (hot wallet private key)
    ▼
@x402/fetch (Node.js subprocess)
    │
    │ 1. fetch(url) → receives 402
    │ 2. Parses PAYMENT-REQUIRED header (base64 → JSON)
    │ 3. algosdk.mnemonicToSecretKey(mnemonic) → signer
    │ 4. Signs USDC ASA transfer (10000 micro-USDC = $0.01)
    │ 5. Retries with X-PAYMENT header
    │ 6. Facilitator verifies on-chain
    │ 7. Server returns real response
    ▼
Response bubbles back: subprocess → backend → parent → iframe
```

### Why a Hot Wallet (Not User's Wallet)

The `@x402/avm` client SDK requires a **raw Ed25519 private key** to sign the payment transaction. Browser wallets (Pera, Defly) expose only a `transactionSigner` interface — they never reveal the key itself. Therefore:

- **Preview mode:** Platform hot wallet (`X402_MNEMONIC`) pays automatically — no wallet popup
- **Exported/local mode:** User sets their own mnemonic in the server `.env` and runs the full client locally

---

## 📦 All Packages & Dependencies

### Backend (Python — FastAPI)

| Package | Purpose |
|---------|---------|
| `fastapi` + `uvicorn` | HTTP server |
| `langgraph` | Pipeline state machine (orchestrator) |
| `openai` | LLM client (OpenAI-compatible API for any provider) |
| `anthropic` | Direct Anthropic Claude API client |
| `pydantic-settings` | Typed settings from `.env` |
| `httpx` | Async HTTP (Vercel publish, compiler calls) |
| `chromadb` | Vector DB for RAG retrieval (documentation) |
| `sentence-transformers` | Local embeddings for RAG |

### Frontend (TypeScript — Next.js 14)

| Package | Purpose |
|---------|---------|
| `next` 14.1 | React server/client framework |
| `algosdk` 3.5.2 | Build + encode Algorand transactions |
| `@txnlab/use-wallet-react` 4.6.0 | Wallet adapter (Pera, Defly, WalletConnect) |
| `@codesandbox/sandpack-react` 2.13.5 | In-browser code preview (iframe) |
| `zustand` 4.5 | State management |
| `framer-motion` | Animations |
| `lucide-react` | Icons |

### x402 Server (TypeScript — Node.js)

| Package | Purpose |
|---------|---------|
| `@x402/core` 2.11.0 | Protocol engine (resource server, facilitator client) |
| `@x402/avm` 2.11.0 | Algorand payment scheme (ExactAvmScheme, signer, CAIP-2) |
| `@x402/hono` 2.11.0 | HTTP middleware (returns 402, verifies proofs) |
| `@x402/fetch` 2.11.0 | Client SDK (wraps fetch, auto-pays 402s) |
| `hono` 4.1 | Lightweight HTTP framework |
| `@hono/node-server` | Runs Hono on Node.js |
| `algosdk` 3.5.2 | Mnemonic → secret key conversion |
| `dotenv` | Environment variable loading |
| `tsx` | TypeScript execution (no compile step) |

---

## 🔑 Configuration (.env)

```env
# ── LLM Provider ──
LLM_PROVIDER=aicredits                        # Default AI provider
AICREDITS_API_KEY=sk-...                      # API key for AI Credits
AICREDITS_MODEL=gemini-3-flash-preview        # Default model
OPENROUTER_API_KEY=sk-or-...                  # Alternative: OpenRouter

# ── Algorand ──
COMPILER_SERVER_URL=https://compiler.algocraft.fun   # PuyaTS/PuyaPy → TEAL
ALGORAND_TESTNET_URL=https://testnet-api.algonode.cloud
ALGORAND_INDEXER_TESTNET=https://testnet-idx.algonode.cloud
DEFAULT_NETWORK=testnet

# ── Simulation ──
ALGORAND_SIMULATOR_MNEMONIC="25-word mnemonic"  # Funded account for post-deploy simulation
SIMULATE_ENABLED=true

# ── x402 ──
X402_MNEMONIC="25-word mnemonic"              # Hot wallet for x402 demo payments (needs USDC)

# ── Publishing ──
VERCEL_API_TOKEN=...                          # One-click deploy to Vercel
```

---

## 🧪 Testing Infrastructure

| Tool | File | What it tests |
|------|------|---------------|
| Pipeline test | `backend/test_pipeline.py` | Full generate → compile → deploy-ready flow |
| Wiring analyzer | `backend/test_pipeline_wiring.py` | Contract method ↔ frontend coverage |
| x402 client test | `x402-server/_x402_client_run.ts` | Direct x402 payment (no UI) |
| x402 proxy test | `curl POST /api/v1/x402-proxy` | Backend proxy end-to-end |

---

## 📐 Key Design Decisions & Rationale

| Decision | Why |
|----------|-----|
| **LLM generates code, not templates** | Infinite prompt variety; templates can't handle "Build a voting app with 3 candidates and a deadline" |
| **Remote compilation** | PuyaTS compiler requires full Node.js + Python toolchain (~2GB). Users can't install that |
| **Iframe/bridge architecture** | Security: generated code NEVER holds wallet keys. Parent window signs, iframe displays |
| **Retry loop (5 attempts)** | LLM-generated code regularly has syntax errors. Feeding compiler errors back usually fixes it in 2-3 tries |
| **ARC-32 drives frontend** | The compiled contract's ABI spec is the source of truth for `useContract` hook generation. No guessing |
| **Hot wallet for x402** | x402 SDK needs raw keys; browser wallets don't expose them. Platform fronts micro-payments for demo |
| **USDC (not ALGO) for x402** | The goplausible facilitator only verifies USDC ASA transfers. This is an x402 ecosystem decision, not ours |
| **BYOK (Bring Your Own Key)** | Users provide their own LLM API key. No platform key needed (except for the default AICredits provider) |
| **SSE streaming** | Pipeline events stream to the frontend in real-time. User sees each step as it happens |
| **Security audit after compile** | Catches fund-draining bugs, missing access control, and logic flaws before the user signs a deploy transaction |

---

## 🗂️ Complete File Map

```
AlgoVibe/
├── .env                                    ← All secrets and config
├── PROJECT_DEEP_DIVE.md                    ← This file
│
├── backend/                                ← Python FastAPI server (port 8000)
│   ├── app/
│   │   ├── main.py                         ← FastAPI app + CORS + route registration
│   │   ├── agents/
│   │   │   ├── orchestrator.py             ← LangGraph pipeline (the brain)
│   │   │   ├── architect.py                ← Prompt → JSON spec
│   │   │   ├── algorand_agent.py           ← Spec → PuyaTS/PuyaPy contract
│   │   │   ├── react_agent.py              ← ARC-32 → React frontend + hooks
│   │   │   └── security_auditor.py         ← Vulnerability detection
│   │   ├── services/
│   │   │   ├── compiler_client.py          ← HTTP call to remote compiler
│   │   │   ├── deployment_generator.py     ← Deploy script generation
│   │   │   ├── dapp_path_verifier.py       ← Checks UI→contract wiring
│   │   │   ├── dapp_path_repair.py         ← Auto-fixes broken wiring
│   │   │   ├── dapp_simulator.py           ← Post-deploy testnet simulation
│   │   │   ├── vercel_publish.py           ← Vercel deployment API
│   │   │   └── build_store.py              ← Stores build state between sign steps
│   │   ├── api/routes/
│   │   │   ├── generate.py                 ← POST /api/v1/generate (SSE pipeline)
│   │   │   ├── x402_proxy.py              ← POST /api/v1/x402-proxy (payment proxy)
│   │   │   ├── publish.py                  ← POST /api/v1/publish (Vercel deploy)
│   │   │   ├── llm.py                      ← POST /api/v1/validate-llm
│   │   │   └── protocols.py               ← GET /api/v1/protocols
│   │   ├── core/
│   │   │   ├── config.py                   ← Pydantic settings (reads .env)
│   │   │   ├── llm.py                      ← Unified LLM client (OpenRouter/Anthropic/AICredits/Ollama)
│   │   │   ├── llm_config.py              ← Request-scoped BYOK credentials
│   │   │   └── memory.py                  ← Agent memory persistence
│   │   ├── rag/
│   │   │   ├── retriever.py               ← ChromaDB vector search
│   │   │   ├── embeddings.py              ← sentence-transformers encoder
│   │   │   └── prompts.py                 ← RAG prompt templates
│   │   └── templates/
│   │       └── frontend.py                ← Static frontend template pieces
│   ├── knowledge/                          ← Algorand documentation for RAG
│   └── test_pipeline.py                    ← CLI pipeline tester
│
├── frontend/                               ← Next.js 14 app (port 3000)
│   ├── app/                                ← Next.js app router
│   ├── components/
│   │   ├── preview/
│   │   │   └── BridgeHandler.tsx           ← THE BRIDGE: postMessage → wallet → chain
│   │   ├── settings/
│   │   │   ├── LlmSettingsModal.tsx        ← AI provider configuration UI
│   │   │   └── X402SettingsModal.tsx       ← x402 server endpoint UI
│   │   ├── chat/                           ← Chat UI components
│   │   └── layout/
│   │       └── Navbar.tsx                  ← Settings buttons (AI + x402)
│   ├── lib/
│   │   ├── store.ts                        ← Zustand state (pipeline, wallet, files)
│   │   ├── bridge-protocol.ts             ← Type definitions for bridge messages
│   │   ├── preview-bridge-hooks.ts        ← Injects hooks + x402 URL into Sandpack
│   │   ├── llm-settings.ts               ← AI key persistence (sessionStorage)
│   │   ├── x402-settings.ts              ← x402 endpoint persistence
│   │   ├── api.ts                         ← Backend API client functions
│   │   ├── algorand-state.ts             ← On-chain state reading helpers
│   │   ├── abi-tx.ts                     ← ARC-32 → transaction building helpers
│   │   └── fix-use-contract.ts           ← Patches generated useContract imports
│   └── package.json
│
├── x402-server/                            ← Standalone x402 resource server (port 4021)
│   ├── index.ts                           ← Hono + @x402/hono payment middleware
│   ├── package.json                       ← @x402/*, algosdk, hono, tsx
│   ├── .env.template                      ← Required: AVM_ADDRESS, X402_MNEMONIC
│   └── tsconfig.json
│
└── .github/workflows/
    └── docker-build.yml                   ← CI: Docker image for backend
```

---

## 🔄 Data Flow Summary

```
USER INPUT                    BACKEND PROCESSING                 BLOCKCHAIN
─────────────────────────────────────────────────────────────────────────────

"Build a voting       ──▶   Architect (LLM) ──▶ spec.json
 app"                       AlgorandAgent (LLM) ──▶ contract.algo.ts
                            CompilerClient ──▶ approval.teal + arc32.json
                            SecurityAuditor ──▶ findings[]
                                        │
                                        ▼
                            emit "sign_required" ──────────────▶ User signs
                                                                    │
                                                                    ▼
                                                              Deploy txn
                                                              submitted
                                                                    │
                                                                    ▼
                            /finalize (App ID) ◀──────────── App ID returned
                            ReactAgent (LLM) ──▶ App.tsx + hooks
                            PathVerifier ──▶ wiring check
                                        │
                                        ▼
                            Files → Sandpack preview ──▶ User interacts
                                                              │
                                                              ▼
                                                     postMessage CALL_METHOD
                                                              │
                                                              ▼
                                                     BridgeHandler builds txn
                                                     Wallet signs
                                                     Submit to Algorand
                                                     Confirmed in ~3.3s
```

---

## 🌍 External Services

| Service | URL | Role | Required? |
|---------|-----|------|-----------|
| PuyaTS Compiler | `compiler.algocraft.fun` | Compiles contract code → TEAL | Yes |
| Algorand TestNet Node | `testnet-api.algonode.cloud` | Submit txns, read state | Yes |
| Algorand Indexer | `testnet-idx.algonode.cloud` | Historical lookups | For simulation |
| x402 Facilitator | `facilitator.goplausible.xyz` | Verifies x402 payments on-chain | For x402 only |
| LLM Provider | `api.aicredits.in/v1` or OpenRouter | AI code generation | Yes |
| Vercel | `api.vercel.com` | One-click frontend publishing | Optional |

---

## 🔒 Security Model

| Concern | How it's handled |
|---------|-----------------|
| Wallet keys | NEVER in generated code. Bridge pattern isolates signing in parent window |
| LLM API keys | Stored in sessionStorage (browser-only). Sent per-request via headers |
| Hot wallet mnemonic | Server-side only (.env). Never exposed to frontend |
| Generated contract bugs | Security auditor catches before deploy. User reviews before signing |
| XSS in preview | Sandpack iframe is sandboxed on a separate origin (codesandbox.io) |
| CORS | Backend restricts to localhost:3000 in dev. Vercel handles in prod |

---

*This document was generated from the actual codebase, not from README summaries. Every package, every flow, every decision is traceable to real code.*
