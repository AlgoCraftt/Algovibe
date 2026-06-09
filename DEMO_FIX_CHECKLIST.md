# Demo Day Fix Checklist

Tracking progress on fixing demo-killing issues before live presentation.

## 🚨 DEMO-KILLERS

- [x] **#1** Wallet notification doesn't reach iframe in time → Fixed: escalating retries (0/500/1500/3000/5000ms) + iframe load event + echo on first bridge message
- [x] **#2** Hook patching misses non-standard paths → Fixed: patches ANY path containing 'useAlgorand' regardless of prefix
- [x] **#3** Invalid API key kills SSE stream silently → Fixed: try/except around asyncio.gather with proper error SSE event
- [x] **#4** x402 subprocess TimeoutExpired not caught → Fixed: explicit catch returns clean error response
- [x] **#5** No pipeline timeout (LLM hang = infinite wait) → Fixed: 120s asyncio.wait_for on every LLM call
- [x] **#6** Retry loop takes up to 6 minutes → Fixed: early termination when same error repeats 3 times

## ⚠️ HIGH SEVERITY

- [x] **#7** waitForConfirmation hangs with no timeout → Fixed: 30s Promise.race timeout on both opt-in and method calls
- [ ] **#8** Wallet popup rejected → next signing may fail (WalletConnect state issue — needs wallet SDK investigation)
- [ ] **#9** uint8/uint16 args encoded wrong (needs ARC-4 type width handling — low risk for demo since most contracts use uint64)
- [ ] **#10** x402 settings must be configured BEFORE build (design limitation — documented in demo prep)
- [x] **#11** setGeneratedFiles merges instead of replaces → Fixed: clear generatedFiles + arc32Spec + contractId on new build
- [ ] **#12** CORS error shown instead of real error on x402 proxy failure (only on 500s, mitigated by #4 fix)

## 🟡 MEDIUM

- [x] **#13** Error context snowballs on retries → Fixed: truncate to 500 chars
- [ ] **#14** Race in opt-in check if algodClient not ready (rare, needs wallet provider timing investigation)
- [ ] **#15** iframe source may be dead after async op (no-op, not a crash)
- [x] **#16** 100ms artificial delay between SSE events → Fixed: reduced to 10ms

## 🆕 ADDITIONAL FIXES

- [x] **#17** Box storage reference error (invalid Box reference) → Fixed: simulate transaction first to auto-discover required resources (boxes, accounts, assets, apps) then rebuild with references populated

## Summary

**Fixed: 11/17 issues** (all 6 demo-killers + 5 high/medium + box storage)
**Remaining 6:** Either low-risk for demo, design limitations, or require deeper wallet SDK work.
