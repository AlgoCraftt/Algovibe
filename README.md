# AlgoVibe

**Text-to-Algorand-dApp builder** — describe an app in natural language, generate a **Puya** smart contract, compile it, sign deployment with your wallet, and interact with a live **React** preview on Algorand testnet.

Private keys never enter generated preview code. Transactions are signed in the parent app via a Sandpack **bridge** (`BridgeHandler`).

---

## Quick start

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env — at minimum set COMPILER_SERVER_URL and an LLM key (or use BYOK in the UI)

# 2. Backend (port 8000)
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 3. Frontend (port 3000) — new terminal
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000/chat**, connect a testnet wallet (Pera / Defly / etc.), enter a prompt, sign the app-create transaction when asked, then use the Sandpack preview.

**Success looks like:** pipeline reaches `complete`, preview loads, buttons trigger wallet prompts, Lora link shows your app ID.

Full setup (compiler, simulation, BYOK, troubleshooting): **[docs/SETUP.md](docs/SETUP.md)**

---

## Documentation

| Document | Description |
|----------|-------------|
| [docs/SETUP.md](docs/SETUP.md) | Environment variables, wallet, compiler, BYOK, testnet simulation |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, pipeline, Sandpack bridge, folder layout |
| [docs/SMART_CONTRACTS.md](docs/SMART_CONTRACTS.md) | Puya generation, ABI, pay methods, opt-in, examples |
| [docs/API.md](docs/API.md) | HTTP API reference and SSE steps |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Commit conventions and repo structure |

---

## Repository layout

```
Algovibe/
├── backend/          # FastAPI — agents, compile, path verify, simulate
├── frontend/         # Next.js — chat, wallet, Sandpack preview, bridge
├── docs/             # Setup, API, smart contract guides
├── ARCHITECTURE.md   # Deep technical architecture
└── .env.example      # Environment template (copy to .env)
```

---

## Core flow

```
Prompt → analyzing → generating_contract → compiling → sign_required
  → user signs app create → finalize → generating_react
  → verifying_paths → (simulating) → complete → Sandpack preview
```

---

## Submission / review branch

For hackathon and jury review, use branch **`release/round3`** — documentation and review-friendly commit history on top of `master`.

```bash
git checkout release/round3
```

---

## License

See repository license file if present; otherwise contact the maintainers.
