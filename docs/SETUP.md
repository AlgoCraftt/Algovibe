# Setup guide

This guide gets AlgoVibe running locally for development and demos.

---

## Prerequisites

| Requirement | Version / notes |
|-------------|-----------------|
| **Python** | 3.11+ recommended |
| **Node.js** | 18+ (for Next.js frontend) |
| **Puya compiler** | HTTP service — set `COMPILER_SERVER_URL` in `.env` |
| **Algorand wallet** | Pera, Defly, Exodus, or Lute on **testnet** |
| **LLM API key** | OpenRouter, OpenAI, or Anthropic — server `.env` and/or BYOK in UI |

---

## 1. Environment configuration

```bash
cp .env.example .env
```

Edit `.env` at the **repository root** (loaded by `backend/app/core/config.py`).

### Required

| Variable | Purpose |
|----------|---------|
| `COMPILER_SERVER_URL` | HTTP endpoint that compiles Puya TS/Python to TEAL + ARC-32 |
| `OPENROUTER_API_KEY` **or** `ANTHROPIC_API_KEY` | Server-side LLM when user does not use BYOK |

### Recommended for demos

| Variable | Purpose |
|----------|---------|
| `SIMULATE_ENABLED=true` | Run post-deploy `algod` simulate on testnet |
| `ALGORAND_SIMULATOR_MNEMONIC` | 25-word testnet account mnemonic (fund via [testnet dispenser](https://bank.testnet.algorand.network/)) |

### Frontend (local)

Create `frontend/.env.local` if the backend is not on the default host:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

On Vercel or reverse-proxy deployments, point this at your backend URL (e.g. `/_/backend`).

---

## 2. Install and run backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Verify: `GET http://localhost:8000/health` should return OK.

---

## 3. Install and run frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000/chat**.

---

## 4. Bring your own key (BYOK)

Users can configure LLM credentials in the UI (**AI Settings** in the navbar):

1. Choose provider: OpenRouter, OpenAI, or Anthropic.
2. Paste API key and model ID.
3. Validate — calls `POST /api/v1/llm/validate`.
4. Subsequent generate/finalize/fix requests send headers:
   - `X-LLM-Provider`
   - `X-LLM-Api-Key`
   - `X-LLM-Model`

Settings are stored in **sessionStorage** only (not on the server database).

---

## 5. Wallet and testnet

1. Connect wallet in the chat UI.
2. Switch wallet to **Testnet**.
3. Ensure the account has ALGO for app creation and transactions ([dispenser](https://bank.testnet.algorand.network/)).
4. Run a prompt (e.g. “Tip jar — send tips to the contract”).
5. When the pipeline shows **sign required**, approve the application create transaction.
6. After finalize, the preview loads with your **app ID** (Lora link in toolbar).

---

## 6. Testnet simulation (optional)

When `SIMULATE_ENABLED=true` and `ALGORAND_SIMULATOR_MNEMONIC` is set, after deploy the backend:

- Opts the simulator account into the app if needed.
- Simulates each ABI method with synthetic arguments.

This validates the contract path without spending user funds beyond deploy.

---

## 7. Troubleshooting

| Symptom | Check |
|---------|--------|
| Pipeline stops at compile | `COMPILER_SERVER_URL` reachable; contract logs in SSE |
| `Invalid API key` | BYOK validation or server `.env` keys |
| Preview buttons do nothing | Wallet connected; parent `BridgeHandler` loaded (not iframe-only export) |
| `Method 'X' expects N arguments` | Pay methods use `payment: { amount }` — see [SMART_CONTRACTS.md](SMART_CONTRACTS.md) |
| Simulation skipped | `app_id` missing until deploy; mnemonic funded on testnet |

---

## 8. Docker (CI)

A GitHub Actions workflow builds backend images when `docker-compose.yml` changes. If you add Docker Compose for self-hosting, document the command here:

```bash
# Example (when docker-compose.yml is added):
docker compose up --build
```

---

## Next steps

- [ARCHITECTURE.md](../ARCHITECTURE.md) — how the pipeline and bridge work
- [SMART_CONTRACTS.md](SMART_CONTRACTS.md) — contract generation rules
- [API.md](API.md) — HTTP endpoints
