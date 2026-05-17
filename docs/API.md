# HTTP API reference

Base URL (local): `http://localhost:8000`  
Prefix: `/api/v1`

Interactive OpenAPI: `http://localhost:8000/docs` (FastAPI auto-generated).

---

## Health

```http
GET /health
```

Returns service readiness.

---

## Generate pipeline

### `POST /api/v1/generate`

Starts the full build pipeline. Response is **Server-Sent Events** (`text/event-stream`).

**Request body:**

```json
{
  "prompt": "Build a tip jar dApp",
  "framework": "puyats",
  "network": "testnet",
  "user_wallet": "OPTIONAL_ALGO_ADDRESS"
}
```

**Optional headers (BYOK):**

| Header | Description |
|--------|-------------|
| `X-LLM-Provider` | `openrouter` \| `openai` \| `anthropic` |
| `X-LLM-Api-Key` | User API key |
| `X-LLM-Model` | Model ID for provider |

**Typical SSE `step` values (phase 1 — until deploy):**

| step | Meaning |
|------|---------|
| `analyzing` | Prompt → contract spec |
| `retrieving_docs` | Documentation context (may be stubbed) |
| `generating_contract` | Puya source generation |
| `compiling` | Remote compiler |
| `retrying` | Compile failed; retrying with fixes |
| `deploying` | Preparing deploy package |
| `sign_required` | User must sign app create in wallet |
| `error` | Pipeline failed |

**`sign_required` payload** includes `build_id`, TEAL/ARC-32, and fields needed by `DeploySignPrompt`.

**Example (curl):**

```bash
curl -N -X POST http://localhost:8000/api/v1/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Tip jar dApp","framework":"puyats","network":"testnet"}'
```

---

### `POST /api/v1/finalize`

Resumes after the user deploys and obtains an **application ID**.

**Request body:**

```json
{
  "build_id": "uuid-from-sign_required",
  "package_id": "12345678"
}
```

`package_id` is the on-chain **app ID** (integer as string).

**Typical SSE `step` values (phase 2):**

| step | Meaning |
|------|---------|
| `deployed` | App ID recorded |
| `generating_react` | UI + hooks generation |
| `verifying_paths` | ABI ↔ UI wiring check |
| `path_check_complete` | Path report ready |
| `simulating` | Optional testnet simulate |
| `simulation_complete` | Simulate report |
| `complete` | `files`, `app_id`, reports in event |
| `error` | Failure |

---

### `POST /api/v1/fix-frontend`

Patches preview files only (no recompile/redeploy).

**Request body:**

```json
{
  "prompt": "Make the tip button larger",
  "files": { "/App.tsx": "...", "/hooks/useContract.ts": "..." },
  "preview_error": "optional runtime error string",
  "app_id": "12345678"
}
```

**SSE steps:** `fixing_frontend` → `complete` (with `files`) or `error`.

---

## LLM validation

### `POST /api/v1/llm/validate`

Validates BYOK credentials before chat generation.

**Request body:**

```json
{
  "provider": "openrouter",
  "api_key": "sk-...",
  "model": "google/gemini-3-flash-preview"
}
```

**Response:**

```json
{
  "valid": true,
  "provider": "openrouter",
  "model": "google/gemini-3-flash-preview"
}
```

---

## Protocols

### `GET /api/v1/protocols`

Returns ecosystem protocol chips (Tinyman, etc.) for the chat UI.

---

## Publish (optional)

### `POST /api/v1/publish`

Vercel publish helpers — not required for core demo flow.

---

## SSE event shape

Each line:

```
data: {"step":"compiling","message":"Compiling contract..."}
```

On `complete`, expect fields such as:

- `files` — Sandpack file map
- `app_id` / `contract_id`
- `path_report` — path verification result
- `simulation_report` — when simulation ran

---

## Errors

| Code / step | Cause |
|-------------|--------|
| `error` + `invalid_api_key` | BYOK or server LLM key rejected |
| `error` (compile) | Max retries exceeded |
| HTTP 400 | Missing `prompt`, `build_id`, or `package_id` |

---

## Related

- [SETUP.md](SETUP.md) — environment and wallet
- [ARCHITECTURE.md](../ARCHITECTURE.md) — pipeline internals
