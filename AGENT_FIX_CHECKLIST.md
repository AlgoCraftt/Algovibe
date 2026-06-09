# Agent Optimization Fix Checklist

Tracking the priority fixes from AGENT_DEEP_DIVE.md.

## Priority Fixes

- [x] **#1** Raise max_tokens → algorand 4096→8192, react 8000→16000 + scaled timeout (120s/240s)
- [x] **#2** Template-aware skill loading → only loads transactions.md when contract uses payments/itxn/gtxn; storage/types/methods always
- [x] **#3** Fix auditor false-positive regexes → multi-line aware (re.DOTALL) for payment receiver + amount; robust method extraction
- [x] **#4** Conditional context → opt-in example (50 lines) now only loaded when spec has local_state
- [~] **#5** Lead with examples / shorten banned list → DEFERRED: banned list + error-corrections are hard-won and valuable; max_tokens + skill-loading fixes address the real bottleneck (output truncation). Left intact to avoid regression.
- [x] **#6** Removed "max 5 methods" cap → now "include exactly what the feature needs" + scope discipline + pay/asset types documented
- [x] **#7** Auditor adversarial reframe + business_logic invariants injected
- [x] **#8** LLM audit now runs whenever funds are involved (itxn/gtxn/app address), not just named templates
- [x] **#9** Spec-coverage check post-generation → warns if any spec method missing from code

## Summary

**Done: 8/9** (one deferred intentionally to avoid breaking the working error-correction system).

### Impact
- **Truncation fixed** (#1): biggest win — complex contracts + premium UIs no longer cut off mid-generation
- **Context focus** (#2, #4): fewer irrelevant tokens → better attention on the actual task + faster/cheaper calls
- **Auditor trust** (#3, #7, #8): no more false positives; adversarial mindset; broader fund coverage
- **Scope accuracy** (#6): no artificial method cap, no invented features
- **Visibility** (#9): logs when generated code misses spec methods

### Not changed (deliberate)
- The BANNED-patterns list and 12 error-correction regexes in algorand_agent — these are accurate and the deep-dive explicitly recommended keeping them. The bottleneck was output token budget and context bloat, both now addressed.
