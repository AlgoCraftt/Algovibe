# Demo Video — Transformation Story (max 5:00)

> **This is NOT a feature showcase.** It is a transformation story: pain → browser-native creation → live proof → **ecosystem impact** → vision.

## Your secret weapon (say it loud)

> **During this hackathon, six separate teams used AlgoCraft IDE to build and deploy their smart contracts.**

That is **validation**, not a footnote. Repeat it in the video (minute ~3:30) and in every written submission.

---

## Golden rules

| Do | Don't |
|----|-------|
| Transformation story | Button tour / tab reading |
| Lead with **pain** + **6 teams** | Bury traction at 0:55 |
| New visual every **5–8 seconds** | Sit on compile spinner in silence |
| **Browser-native**, **zero setup**, **secure signing** | "ChatGPT for Algorand", "AI wrapper", "no-code" |
| **Accelerate developers** | "Replace developers" |
| VibeKit = **ecosystem evolution** | "Our thing better bro" |

**Repeat these phrases** (judges remember repetition):

- browser-native  
- zero setup  
- onboarding friction  
- rapid prototyping  
- secure signing  
- deployment pipeline  
- developer acceleration  
- accessibility  

---

## Before recording

- Branch: `release/round3`
- Wallet: Pera/Defly **testnet**, funded
- Prompt: something judges **instantly get** — e.g. **milestone escrow**, **crowdfunding**, **DAO voting**, **donation tracker** (not "todo app")
- Lora testnet tab ready
- Pre-record backup if live compile is slow; **cut dead air** in edit

---

# THE MOVIE (shot-by-shot)

## 0:00 → 0:40 — THE PAIN

**Visual:** Fast cuts. No AlgoVibe UI yet.

- Terminal / `npm install` errors  
- SDK / compiler config screens  
- Deployment scripts  
- Wallet + frontend wiring diagram (messy)

**Voiceover:**

> For many developers, the hardest part of Web3 isn’t ideas. It’s setup.

> Before building on Algorand, developers often configure local environments, compilers, wallets, deployment flows, and frontend integrations — scattered across tools.

> **We wanted to remove that friction.**

*(2-second beat)*

> Algorand development still has real onboarding friction. The ecosystem is moving fast — but the first mile is still brutal.

---

## 0:40 → 1:10 — INTRODUCE ALGOVIBE

**Visual:** Clean. Landing → `/chat`. Simple pipeline graphic on screen:

```text
Prompt → Generate → Compile → Sign → Deploy → Live Preview
```

**Voiceover:**

> **AlgoVibe** is a **browser-native** platform that transforms natural language into **deployable Algorand applications** — zero local MCP ritual, zero “init your entire dev environment before you write one line.”

Do **not** overexplain agents yet. Let the pipeline graphic breathe.

---

## 1:10 → 3:10 — LIVE BUILD (money section)

**Visual:** Full flow at pace. Cut compile wait in post if needed.

1. Connect wallet  
2. Enter strong prompt, e.g.:  
   *"Build a milestone escrow: client deposits ALGO, freelancer submits milestone, client approves release. Include a minimal UI on testnet."*  
3. Pipeline steps flash: analyzing → generating → compiling  
4. **`sign_required`** — **PAUSE 2 sec** on wallet popup  

**Voiceover (while demo runs):**

> The platform generates a **Puya** smart contract, compiles it through our **shared compiler infrastructure**, and isolates transaction signing through a **secure bridge architecture**.

### Security line (SAY EXACTLY)

> **Private keys never enter generated runtime code.**

When wallet appears:

> Signing occurs **outside** the generated sandbox through **BridgeHandler** isolation.

5. Confirm deploy → show **app ID**  
6. Quick Lora flash (app create tx)  
7. Preview loads → **one on-chain action** (approve milestone / vote / donate)  
8. Second wallet sign → UI updates  

> Once deployed, the system generates an interactive frontend preview connected directly to **Algorand testnet** — real transactions, not a mock.

**Pacing:** If nothing happens for 5+ seconds, cut or voiceover over it. Never read UI labels aloud.

---

## 3:10 → 4:00 — ECOSYSTEM + SOCIAL PROOF (BOOM)

**Visual:** Quick montage — **AlgoCraft suite**, not before this beat.

- Algorand **IDE** (Monaco / deploy)  
- **AlgoFlow** (visual builder)  
- **compilerserver** diagram or health endpoint  

**Voiceover:**

> AlgoVibe is part of the broader **AlgoCraft** ecosystem — IDE, Flow, and shared compile infrastructure for Algorand builders.

### BOOM LINE (pause, let it land)

> **During this hackathon, six separate teams used AlgoCraft IDE to build and deploy their smart contracts.**

That means we’re not only shipping our own demo — **other builders already relied on our infra.**

*(Optional one line)* Round 3 added AlgoVibe: **BYOK**, **Docker one-command**, and **Ollama** so the creation stack is accessible in any workshop.

---

## 4:00 → 5:00 — VIBEKIT + VISION + ENDING

**Visual:** Simple slide or calm talking head. No new features.

**VibeKit (ecosystem evolution, not competitor):**

> Algorand’s ecosystem is evolving rapidly with AI-assisted tooling like **VibeKit**. We wanted to push accessibility further — **removing local setup entirely** and enabling **browser-native** application creation for first-time builders.

**Vision:**

> We believe the biggest barrier to Web3 adoption is not blockchain scalability. It’s **developer accessibility**.

> Our goal is to make Algorand approachable for developers, students, and first-time builders — **rapid experimentation**, then hand off to AlgoKit or VibeKit when they’re ready to go deep.

### FINAL LINE (cut to black)

> **We’re not just building applications on Algorand. We’re building the fastest path into the ecosystem.**

**AlgoCraft — init into Algorand.**

---

## What NOT to include as a main act

- Long BYOK settings tour (one flash max, or skip)  
- Protocol chip deep dive (mention in description, not video)  
- Round 2 changelog list (one line only)  
- Reading commit messages or README  

---

## Checklist before upload

- [ ] Pain montage in first 40s  
- [ ] Pipeline graphic shown clearly  
- [ ] **"Private keys never enter generated runtime code"** spoken  
- [ ] Wallet pause + BridgeHandler line  
- [ ] App create + **one** app-call on Lora  
- [ ] **"Six teams used AlgoCraft IDE"** spoken clearly (~3:30)  
- [ ] VibeKit framed as ecosystem evolution  
- [ ] Strong final line  
- [ ] Total ≤ 5:00  

---

## Title & description

**Title:** AlgoCraft — Six Teams Built on Our Stack | Browser-Native Algorand dApps

**Description:**

AlgoVibe: natural language → Puya → compile → wallet deploy → live testnet preview. During Hackseries 3, **6 teams used AlgoCraft IDE** to ship contracts. Browser-native, secure BridgeHandler signing, part of the AlgoCraft suite. `release/round3`
