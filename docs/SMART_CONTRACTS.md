# Smart contract documentation

How AlgoVibe generates, compiles, and wires **Algorand smart contracts** (Puya) to the React preview.

---

## Overview

| Stage | Component | Output |
|-------|-----------|--------|
| Spec | `backend/app/agents/architect.py` | JSON contract spec (methods, state, UI hints) |
| Code | `backend/app/agents/algorand_agent.py` | Puya TypeScript (`puyats`) or Python (`puyapy`) |
| Compile | `backend/app/services/compiler_client.py` | Approval/clear TEAL, **ARC-32** JSON |
| Deploy | User wallet (parent app) | On-chain application ID |
| UI bridge | `react_agent.py` + `BridgeHandler.tsx` | `useContract` hooks + signed transactions |

Supported frameworks: **`puyats`** (default), **`puyapy`**, legacy **`tealscript`**.

---

## Contract generation (`algorand_agent.py`)

The agent:

1. Loads skills from `backend/knowledge/algorand-agent-skills/` when present.
2. Injects RAG documentation when enabled (otherwise stubbed in orchestrator).
3. Applies a **pre-compile sanitizer** for banned patterns (wrong OptIn on business methods, etc.).
4. Retries with **error-specific corrections** when compilation fails.

### Opt-in and local state

Apps with **local state** require a dedicated opt-in path:

1. User opts in (`OptIn` application call, often with ABI selector).
2. Business methods run as `NoOp` + ABI args.

**Anti-pattern** (removed by sanitizer):

```typescript
@abimethod({ allowActions: 'OptIn' })
public cast_vote(...) { }  // WRONG if optInToApplication() exists
```

Use `optInToApplication()` for opt-in, then `cast_vote()` as `NoOp`.

### `create` vs `createApplication`

| Method | When |
|--------|------|
| `createApplication` | Runs on app creation (initial global state) |
| `create(...)` | Business method after deploy (e.g. admin initializes voting) |

---

## ARC-32 and the frontend

After compile, **ARC-32** JSON drives:

- Method selectors and argument types
- `call_config` hints (`no_op`, `opt_in`, …)
- Global/local state schema

Generated files include `contract.arc32.json` in the preview bundle. The parent wallet uses this spec in `BridgeHandler` to build application call transactions.

---

## Pay methods (`pay` ABI type)

Methods like **`tip(pay) void`** require a **grouped payment transaction**, not an encoded ABI argument in `appArgs`.

### Contract (conceptual Puya)

```typescript
@abimethod()
public tip(payment: PayTxn): void {
  // contract logic using payment amount
}
```

### Generated hook (`useContract.ts`)

```typescript
tip: async (amountMicroAlgos: number) =>
  callMethod({
    method: 'tip',
    args: [],
    app_id: APP_ID,
    payment: { amount: amountMicroAlgos },
  }),
```

### Bridge behavior (`BridgeHandler.tsx`)

- **`args`** — only non-`pay` ABI parameters.
- **`payment.amount`** — microAlgos sent to the application address in txn group `[pay, appCall]`.
- Validation excludes `pay` from the `args.length` check.

### Example: Tip Jar

1. User enters amount in ALGO → convert to microAlgos (`1 ALGO = 1_000_000`).
2. UI calls `tip(1_000_000)`.
3. User signs grouped txn in wallet.
4. Contract receives payment via `gtxn` reference in TEAL.

---

## Path verification (post-generate)

`dapp_path_verifier.py` and `dapp_path_repair.py` check:

- ABI method names ↔ `useContract` exports ↔ `App.tsx` button handlers
- `APP_ID` placeholder replaced after deploy
- Opt-in flows when local state exists
- Pay methods not passed as raw ABI args in `App.tsx`

SSE steps: `verifying_paths`, `path_check_complete`.

---

## Testnet simulation

`dapp_simulator.py` (when enabled):

- Uses `ALGORAND_SIMULATOR_MNEMONIC` (server-side test account only).
- Opts in and simulates methods with synthetic args.
- Does not replace user wallet testing in preview.

---

## Knowledge and skills

| Path | Role |
|------|------|
| `backend/knowledge/algorand-agent-skills/` | Reference patterns for the contract agent |
| `backend/app/rag/` | ChromaDB retriever (optional; may be stubbed) |
| `backend/scripts/index_algorand_docs.py` | Index docs into vector store |

---

## Example walkthrough: Tip Jar

**Prompt:** “Tip jar on testnet — users send ALGO tips to the contract.”

1. **Spec** — methods: `tip(pay)`, optional `withdraw` (admin), global `total_tips`.
2. **Compile** — ARC-32 lists `tip` with one `pay` arg.
3. **Deploy** — user signs create; `APP_ID` injected into generated files.
4. **UI** — amount input + “Send tip” → `tip(microAlgos)`.
5. **Bridge** — payment txn + app call; keys stay in parent wallet.

---

## Further reading

- [ARCHITECTURE.md](../ARCHITECTURE.md) §10 — Algorand-specific design
- [API.md](API.md) — pipeline SSE steps
- [Algorand ARC-32](https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0032.md)
