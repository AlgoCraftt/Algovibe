 # Demo Video — Full Voiceover Script (max 5:00)

**Target runtime:** 4:45–4:55 · **Tone:** calm, confident, not salesy · **Read at:** ~140 words/min

**Demo prompt (copy-paste):**
> Build a Tip Jar dApp on Algorand: one global counter of total tips received and total tip count. Users pay ALGO to tip. Show stats on load, a tip amount input, and a Tip button. Dark dashboard UI with gold accents.

---

## Master timeline

| Time | Section | On screen |
|------|---------|-----------|
| 0:00–0:40 | Pain | Terminal / setup montage (no AlgoVibe yet) |
| 0:40–1:10 | Intro | Landing → `/chat` + pipeline graphic |
| 1:10–1:25 | Wallet | Connect Pera/Defly testnet |
| 1:25–1:45 | Prompt | Type prompt, hit generate |
| 1:45–2:15 | Pipeline | analyzing → contract → compiling |
| 2:15–2:45 | Deploy sign | sign_required → wallet → app ID → Lora |
| 2:45–3:15 | Live preview | Sandpack → tip button → wallet → UI updates |
| 3:15–3:55 | Ecosystem + 6 teams | Suite montage + BOOM line |
| 3:55–4:55 | VibeKit + close | Slide or talking head → final line |

---

# EXACT DIALOGUE (read this)

---

## 0:00 – 0:40 · THE PAIN

**[VISUAL]** Fast cuts only — terminal, npm errors, Docker, wallet docs, scattered tabs. No AlgoVibe logo yet.

**[0:00]**
> For many developers, the hardest part of Web3 isn't the idea. It's the setup.

**[0:08]**
> Before you ship anything on Algorand, you're often juggling local environments, compilers, wallet flows, deployment scripts, and a React frontend — all in different places.

**[0:18]**
> Tools like AlgoKit and VibeKit help experts in the IDE. But the first mile — your first deployed app you can actually click — is still brutal for most newcomers.

**[0:28]**
> We asked a simple question: what if that first mile happened entirely in the browser?

**[0:34]** *(beat — cut to black or logo sting)*

---

## 0:40 – 1:10 · INTRODUCE ALGOVIBE

**[VISUAL]** AlgoCraft / AlgoVibe landing. Click into **Chat**. Show pipeline graphic:

`Prompt → Generate → Compile → Sign → Deploy → Live Preview`

**[0:40]**
> This is **AlgoVibe** — part of **AlgoCraft**, our browser-native stack for Algorand.

**[0:48]**
> You describe your app in plain English. We run a full deployment pipeline — spec, Puya contract, remote compile, your wallet signs deploy, then a live React preview on testnet.

**[0:58]**
> No MCP setup. No Docker ritual just to get started. **Zero setup** for the person trying Algorand for the first time.

**[1:05]** *(pause — mouse moves to wallet button)*

---

## 1:10 – 1:25 · CONNECT WALLET

**[VISUAL]** Click **Connect wallet**. Choose Pera or Defly. Confirm testnet.

**[1:10]**
> I connect a testnet wallet — same wallets builders already use: Pera, Defly, and others.

**[1:18]**
> Everything on-chain is signed by me, not by a server holding my keys.

**[1:24]**
> Here we have created a bring your own key interface where user can use his keys from various providers and choose llm of their choice.


---

## 1:40 – 1:45 · PROMPT + GENERATE

**[VISUAL]** Paste Tip Jar prompt. Hit send / generate.

**[1:40]**
> I'll build a simple **Tip Jar** — tips in ALGO, on-chain counters, and a UI judges can understand in five seconds.

**[1:50]**
> One prompt starts the pipeline.

**[1:50]** *(let UI animate — don't talk over dead air if compile is slow; see filler below)*

**[FILLER if compile lags — 1:50–2:00]**
> Behind the scenes, an architect agent turns this into a structured spec. A contract agent writes Puya TypeScript — aligned with Foundation agent skills — and sends it to our shared compiler service.

---

## 1:50 – 2:15 · PIPELINE STEPS

**[VISUAL]** Show steps lighting up: **Analyzing** → **Generating contract** → **Compiling**. Optional: flash contract code for 2 sec.

**[1:45]**
> You see every stage — not a black box. Analyzing the request, generating the smart contract, compiling to TEAL and ARC-32.

**[2:00]**
> If compile fails, we retry with targeted fixes — up to five times — before we ever ask you to sign.

**[2:08]** *(step changes to deploy / sign_required)*

---

## 2:15 – 2:45 · DEPLOY — WALLET SIGN (CRITICAL)

**[VISUAL]** **sign_required** modal. **PAUSE 2 full seconds** on wallet popup. Approve. Show **App ID**. Open **Lora** — application create tx.

**[2:08]**
> When compile succeeds, the pipeline pauses. **You** check and sign the application-create transaction — we never deploy with a server hot wallet.

**[2:13]** *(wallet popup visible)*

> **Private keys never enter generated runtime code.**

**[2:19]** *(still on wallet / confirm)*

> Signing happens outside the preview sandbox — through our **BridgeHandler** — so the generated app never sees your mnemonic.

**[2:31]** *(deploy success, app ID on screen)*

> That's a real application on Algorand testnet. Here's the create transaction on Lora — with our **App ID**.
---

## 2:35 – 3:15 · LIVE PREVIEW + ON-CHAIN ACTION

**[VISUAL]** Pipeline completes. **Live Preview** tab. Show stats. Enter tip amount. Click **Tip**. Second wallet approval. Counter updates.

**[2:35]**
> After deploy, we generate the React UI and wire it to the contract ABI — then verify paths so buttons actually call the right methods.
**[2:52]**
> Here we can go to lora explorer and see the deployed smart contract
**[3:00]**
> This preview runs in Sandpack, but every transaction goes through the parent app and **your** wallet — real testnet, not a mock.

**[3:07]** *(click Tip)*

> I'll send a tip — wallet prompts again — and the on-chain state updates in the UI.

**[3:21]** *(UI shows new totals)*

> That's the product: **rapid prototyping** from prompt to clickable dApp, with **secure signing** at every step.

**[3:14]** *(optional: Lora app-call tx — 2 sec)*

---

## 3:39– 3:55 · ECOSYSTEM + SOCIAL PROOF (BOOM)

**[VISUAL]** Quick montage — AlgoCraft IDE, AlgoFlow, compiler service. Can be slides or screen recordings. **Slow down** before the next line.

**[3:39]**
> AlgoVibe isn't a standalone hackathon toy. It's the generative front door of **AlgoCraft** — alongside our IDE, visual Flow builder, and shared Puya compiler infrastructure.

**[3:25]** *(beat)*

**[3:28]** — **SAY THIS CLEARLY, THEN PAUSE 2 SECONDS:**

> **During this hackathon, six separate teams used AlgoCraft IDE to build and deploy their smart contracts.**

**[3:38]**
> That means other builders already relied on our stack — not just our demo. We're emerging **ecosystem infrastructure**, not only a prototype.

**[3:48]**
> Round 3 added AlgoVibe with **bring-your-own-key** for any LLM, **Docker one-command** install, and **Ollama** for local inference — so workshops aren't blocked on one API vendor.

---

## 3:55 – 4:55 · VIBEKIT + VISION + END

**[VISUAL]** Simple slide: "AlgoCraft — init into Algorand" or calm face-cam. No new UI tours.

**[3:55]**
> Algorand's ecosystem is evolving fast — with AI-assisted tooling like **VibeKit** for developers already living in Claude Code and OpenCode.

**[4:05]**
> We're complementary, not competing. VibeKit **inits** the expert's dev environment. **AlgoCraft inits you into Algorand** — browser-native, then export or graduate to AlgoKit and VibeKit when you're ready to go deep.

**[4:18]**
> We believe the biggest barrier to Web3 adoption isn't throughput on chain. It's **developer accessibility** — the brutal learning curve and scattered tools.

**[4:28]**
> Our goal: **developer acceleration** for students, hackathon teams, and first-time builders — without asking them to configure an entire toolchain on day one.

**[4:38]** *(slow down)*

**[4:40]** — **FINAL LINE, THEN CUT TO BLACK:**

> **We're not just building applications on Algorand. We're building the fastest path into the ecosystem.**

**[4:48]**
> **AlgoCraft — init into Algorand.**

**[4:52]** *(end)*

---

## Word-count check

~680 words ≈ **4:50** at moderate pace. Trim filler block if running long; never cut the **6 teams** or **private keys** lines.

---

## Must-say phrases (judges remember repetition)

Say each at least once:

1. browser-native  
2. zero setup  
3. onboarding friction  
4. private keys never enter generated runtime code  
5. secure signing  
6. Algorand testnet — real transactions  
7. six teams used AlgoCraft IDE  
8. fastest path into the ecosystem  

---

## Never say

- "ChatGPT for Algorand"  
- "AI wrapper"  
- "no-code"  
- "replace developers"  
- "better than VibeKit"  

---

## Recording checklist

- [ ] Pain montage 0:00–0:40 (no product UI)  
- [ ] Pipeline graphic visible ~0:45  
- [ ] Wallet connect testnet  
- [ ] Full flow: prompt → compile → **sign** → app ID  
- [ ] Lora: app create tx (~3 sec)  
- [ ] Preview: at least one **Tip** (or your method) + second sign  
- [ ] **"Private keys never enter generated runtime code"** verbatim  
- [ ] **"Six teams… AlgoCraft IDE"** verbatim ~3:28  
- [ ] VibeKit = complementary / ecosystem evolution  
- [ ] Final line + tagline  
- [ ] Total ≤ 5:00  

---

## If something breaks live

| Problem | Say while showing fallback |
|---------|---------------------------|
| Compile slow | Use filler 1:45–2:00 block; cut spinner in edit |
| Deploy fails | Cut to pre-recorded Lora + app ID clip |
| Preview error | Show completed build screenshot + narrate bridge security |
| LLM error | "BYOK lets teams use their own model keys" — flash AI Settings 1 sec |

---

## YouTube / submission metadata

**Title:** AlgoCraft — Six Teams Built on Our Stack | Browser-Native Algorand dApps

**Description:**
AlgoVibe turns natural language into a Puya smart contract, compiles it, and deploys to Algorand testnet with your wallet (Pera/Defly). Live React preview with BridgeHandler signing — keys never in generated code. During Hackseries 3, **6 teams used AlgoCraft IDE** to ship contracts. Part of the AlgoCraft suite. Branch: `release/round3`.

---

## One-page teleprompter (condensed)

```
PAIN: Hardest part is setup. Algorand = env + compiler + wallet + frontend, scattered.
Experts have AlgoKit/VibeKit. First clickable app is still brutal. What if first mile = browser?

INTRO: AlgoVibe / AlgoCraft. English → full pipeline → testnet preview. Zero setup.

WALLET: Testnet Pera/Defly. I sign — server never holds keys.

PROMPT: Tip Jar dApp. One prompt starts pipeline.
PIPELINE: Spec → Puya → compile. Visible steps. Retries on fail.

SIGN: I sign app create. PRIVATE KEYS NEVER ENTER GENERATED RUNTIME CODE.
BridgeHandler — signing outside sandbox.

LORA: Real App ID on testnet.

PREVIEW: Real UI, real wallet txs. Tip on-chain — state updates.

ECOSYSTEM: AlgoCraft suite — IDE, Flow, compiler.
BOOM: SIX TEAMS USED ALGOCRAFT IDE TO BUILD AND DEPLOY. Other builders used our infra.
Round 3: BYOK, Docker, Ollama.

VIBEKIT: Complementary. VibeKit = expert IDE. AlgoCraft = init into Algorand.
Barrier = accessibility, not scalability.

END: Fastest path into the ecosystem. AlgoCraft — init into Algorand.
```
