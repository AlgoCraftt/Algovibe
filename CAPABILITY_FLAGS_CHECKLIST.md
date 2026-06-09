# Capability Flags Implementation

Single source of truth for "what does this contract do" — emitted by Architect, consumed everywhere.

## Tasks

- [ ] **1** Add `capabilities` block to Architect output schema + prompt
- [ ] **2** Add a `derive_capabilities()` helper (fallback when LLM omits flags)
- [ ] **3** algorand_agent._load_skills() reads capabilities instead of re-deriving
- [ ] **4** security_auditor reads capabilities for deep-review decision
- [ ] **5** react_agent reads capabilities (uses_local_state, x402)
- [ ] **6** Architect steers away from demo-fragile patterns based on reliability envelope

## Capability Schema
```json
"capabilities": {
  "uses_payments": bool,      // accepts ALGO/ASA payments (gtxn)
  "sends_funds": bool,        // sends funds out (itxn)
  "uses_local_state": bool,   // per-user state (needs opt-in)
  "uses_box_storage": bool,   // box storage (fragile in preview)
  "is_financial": bool        // handles value → needs deep audit
}
```
