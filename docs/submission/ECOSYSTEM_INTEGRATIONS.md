# Ecosystem Integrations — Submission Checklist

Use this when filling the multi-select integration form. **Be honest:** mark **Live** only if you can demo or point to code; **Planned** or **Skills** otherwise.

---

## Summary table (recommended selections)

| Integration | Status for submission | How it appears in AlgoVibe |
|-------------|----------------------|----------------------------|
| **x402** | **Skills / knowledge** | Bundled `algorand-x402-*` skills in `backend/knowledge/algorand-agent-skills/`; agents can guide x402 patterns; not a one-click protocol chip yet |
| **Tinyman SDK/Router/APIs** | **Live (generation)** | Protocol chip in `registry.py`; structured contract + frontend prompts; swap/group patterns |
| **Folks Finance APIs** | **Live (generation)** | Protocol chip; lending/deposit patterns in prompts |
| **Gora Oracle** | **Live (generation)** | Protocol chip; oracle/price feed patterns |
| **Algorand ASA** | **Live (generation)** | Protocol chip; mint/transfer/opt-in patterns |
| **Pera SDK** | **Wallet (live)** | `@txnlab/use-wallet-react` — Pera, Defly, Exodus, Lute in preview + export |
| **Wormhole** | Planned | Not in registry; roadmap for cross-chain prompts |
| **DID** | Skills / Planned | GoPlausible DID content in ecosystem skills docs; no dedicated chip |
| **Saber APIs** | Planned | Not in codebase |
| **Falcon Signatures (PQC)** | Planned | Not in codebase |
| **X-Chain Wallet** | Planned | Not in codebase |
| **HayStack Router** | Planned | Not in codebase |

---

## What to select on the form (recommended)

**Select (defensible today):**

- [x] **Tinyman** SDK/Router/APIs  
- [x] **Folks Finance** APIs  
- [x] **Gora** Oracle  
- [x] **Pera SDK** *(wallet integration via use-wallet)*  
- [x] **x402** *(agent skills + documentation layer; say “skills + roadmap for paid API gen” if asked)*  

**Optional / if form allows “planned”:**

- [ ] Wormhole  
- [ ] DID  
- [ ] Saber  
- [ ] Falcon Signatures  
- [ ] X-Chain Wallet  
- [ ] HayStack Router  

---

## Detail per integration

### x402

- **Status:** Skills / knowledge (Foundation + GoPlausible patterns vendored)  
- **Evidence:** `backend/knowledge/algorand-agent-skills/skills/algorand-x402-typescript/`, `algorand-x402-python/`  
- **Pitch:** “Agents understand HTTP 402 + Algorand payment flows; protocol chip UI is roadmap.”

### Tinyman SDK/Router/APIs

- **Status:** Live in protocol registry  
- **Evidence:** `backend/app/protocols/registry.py` (`id: tinyman`), `ProtocolsPanel.tsx`, prompt injection in `store.ts`  
- **Demo tip:** Select Tinyman chip + “swap UI” prompt; verify generated code references Tinyman patterns (testnet pools may still need manual config)

### Folks Finance APIs

- **Status:** Live in protocol registry  
- **Evidence:** `id: folks-finance` in registry  
- **Demo tip:** Lending/deposit wording in prompt

### Gora Oracle

- **Status:** Live in protocol registry  
- **Evidence:** `id: gora-oracle` in registry  

### Pera SDK

- **Status:** Live (wallet)  
- **Evidence:** Wallet connect in chat; `BridgeHandler` signing; export templates use standard wallet adapters  
- **Note:** This is **wallet connectivity**, not full Pera Platform SDK feature surface

### Wormhole / DID / Saber / Falcon / X-Chain / HayStack

- **Status:** Planned or ecosystem-skills reference only  
- **Pitch:** “Roadmap protocol chips following same `registry.py` pattern as Tinyman; ASA/DeFi/oracle chips shipped in Round 3.”

---

## AlgoKit & VibeKit (not on form — mention in narrative)

| Stack piece | Relationship |
|-------------|--------------|
| **AlgoKit** | Target stack for exported projects; compile/deploy patterns align |
| **VibeKit** | Same `algorand-agent-skills`; complementary expert IDE layer |
| **compilerserver** | Shared Hackseries3 compile API |

---

## One sentence for judges

> Round 3 ships **protocol-aware generation** for Tinyman, Folks, ASA, and Gora, **Pera-class wallets** for signing, and **x402 knowledge** via Foundation skills — with a clear registry pattern to add Wormhole, DID, and routers next.
