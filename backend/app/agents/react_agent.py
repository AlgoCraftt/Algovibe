"""
React Agent - Generates Algorand frontend code for DApps.

Generates premium React/TypeScript frontends connected to deployed
Algorand smart contracts using @txnlab/use-wallet and algosdk.
"""

import re
import logging
import json
from typing import TypedDict, Dict, Optional

from app.core.llm import generate_completion

logger = logging.getLogger(__name__)

class ReactGenerationResult(TypedDict):
    files: Dict[str, str]

class ReactGenerationError(Exception):
    pass

REACT_AGENT_SYSTEM_PROMPT = """You are a Senior Frontend Engineer at AlgoCraft building VISUALLY STUNNING Algorand DApp UIs.

You generate a single complete App.tsx file. The UI must look like a premium Web3 product — NOT a text list.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY IMPORTS (always include these exactly):
```
import { useState, useEffect, useCallback, useRef } from 'react';
import { useContract, APP_ID } from './hooks/useContract';
import { useAlgorand } from './hooks/useAlgorand';
import './index.css';
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VISUAL DESIGN RULES — these are NON-NEGOTIABLE:
1. Use INLINE STYLES everywhere (no className-only approach). The CSS file provides base styles but inline styles drive the layout.
2. Layout: Full-page dark dashboard. Main content in a centered max-width container. Do NOT add a wallet connect button in App.tsx — export wraps the app in AppShell with WalletConnect in the header; you may show activeAddress as read-only text for gating only.
3. Stats row: Render ALL global state values as glowing metric cards (dark bg, amber border, large number, label below).
4. Action cards: Each contract method gets its own card with a colored header, input fields, and a styled button.
5. Colors: background #0f172a, card bg #1e293b, accent #f59e0b, text white, muted #94a3b8.
6. Spacing: generous padding (1.5rem+), rounded corners (1rem+), subtle box-shadows.
7. Buttons: amber background (#f59e0b), black text, bold, full-width, rounded, hover effect via onMouseEnter/onMouseLeave state.
8. Status feedback: Show loading spinner (inline CSS animation), success (green), error (red) inside each action card.

STRUCTURE TO FOLLOW:
```
export default function App() {
  const { activeAddress } = useAlgorand();
  const { method1, method2, readState, loading, error, success } = useContract();
  const [contractState, setContractState] = useState<any>({});
  // ... input state for each method

  useEffect(() => {
    readState().then(setContractState).catch(() => {});
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: 'white', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* NAVBAR */}
      <nav style={{ borderBottom: '1px solid #1e293b', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 800, fontSize: '1.25rem', color: '#f59e0b' }}>AppName</span>
        <span style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '2rem', padding: '0.4rem 1rem', fontSize: '0.8rem', color: '#94a3b8' }}>
          {activeAddress ? activeAddress.slice(0,6) + '...' + activeAddress.slice(-4) : 'Not connected'}
        </span>
      </nav>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1rem' }}>
        {/* HERO */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, background: 'linear-gradient(to right, #fff, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.5rem' }}>App Title</h1>
          <p style={{ color: '#94a3b8' }}>Description</p>
        </div>

        {/* STATS ROW — one card per global state value */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ background: '#1e293b', border: '1px solid #f59e0b33', borderRadius: '1rem', padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f59e0b' }}>{contractState.someValue ?? '—'}</div>
            <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.25rem' }}>LABEL</div>
          </div>
        </div>

        {/* ACTION CARDS — one per method */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          <div style={{ background: '#1e293b', borderRadius: '1rem', overflow: 'hidden', border: '1px solid #334155' }}>
            <div style={{ background: '#f59e0b', padding: '1rem 1.5rem' }}>
              <h3 style={{ margin: 0, color: '#000', fontWeight: 700 }}>Method Name</h3>
              <p style={{ margin: '0.25rem 0 0', color: '#00000099', fontSize: '0.8rem' }}>Description</p>
            </div>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.75rem', color: 'white', width: '100%' }} placeholder="Param" />
              <button style={{ background: '#f59e0b', color: '#000', fontWeight: 700, border: 'none', borderRadius: '0.5rem', padding: '0.875rem', cursor: 'pointer', width: '100%' }}>Execute</button>
              {error && <div style={{ color: '#f87171', fontSize: '0.8rem' }}>{error}</div>}
              {success && <div style={{ color: '#4ade80', fontSize: '0.8rem' }}>{success}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

API RULES:
- Import and use `useContract()` from `./hooks/useContract` for all method calls
- ALWAYS import APP_ID from `./hooks/useContract`: `import { useContract, APP_ID } from './hooks/useContract'`
- NEVER hardcode a numeric app ID — always use the imported APP_ID constant
- Import and use `useAlgorand()` from `./hooks/useAlgorand` for wallet address
- CRITICAL — METHOD NAMES: The `useContract()` hook exports methods in camelCase. You MUST use the camelCase version of every method name. Examples: `set_frozen` → `setFrozen`, `transfer_nft` → `transferNft`, `get_balance` → `getBalance`. NEVER use snake_case method names from the contract spec directly — always convert them to camelCase when calling from `useContract()`.
- Call `readState()` after every successful transaction to refresh stats
- CRITICAL — GLOBAL STATE KEYS: readState() returns on-chain keys AND ARC-32 schema aliases (e.g. both `td` and `total_donations` if declared in schema). Prefer keys from contract spec `global_state` / ARC-32 `schema.global.declared` — use the `key` field from schema, not invented names.
- CRITICAL — PAY METHODS: Methods with a `pay` argument (e.g. donate(pay)) are called via useContract with a microAlgo amount — NEVER pass payment as an ABI arg. Example: `donate(amountMicroAlgos)` not `donate(paymentTxn)`.
- Load global stats on mount even before wallet connects: call `readState()` in useEffect on mount without requiring activeAddress; only gate opt-in / local actions on wallet.
- Guard write method calls with `if (!activeAddress) return` — show "Connect your wallet" message if not connected
- Each method call goes in its own async handler with try/catch
- CRITICAL — LOCAL STATE OPT-IN: If the contract spec has any `local_state` entries, you MUST implement an opt-in flow:
  1. On load, call `readState()` — it returns `{ __opted_in__: boolean, ...globalState }`. Check `state.__opted_in__`
  2. If `__opted_in__` is false or undefined, show a prominent "Opt In to App" card BEFORE showing any action buttons
  3. The opt-in button MUST call `callMethod({ method: '__optIn__', args: [], app_id: APP_ID })` from `useAlgorand()` — NEVER call `opt_in()` from `useContract()`, that does not exist
  4. After opt-in succeeds, set local state `hasOptedIn = true` and show the normal action UI
  5. After opt-in succeeds, call `refreshData()` — trust `__opted_in__` from chain on reload
  6. For uint64 contract args (e.g. cast_vote(0|1)), pass JavaScript numbers — NEVER BigInt literals (0n)
  7. NEVER use JSON.stringify() on contractState (may contain bigint from chain)
  Example — COPY THIS EXACTLY:
  ```tsx
  const { activeAddress, callMethod, onWalletReady } = useAlgorand();
  const { vote, readState, loading, error, success } = useContract();
  const [hasOptedIn, setHasOptedIn] = useState(false);
  const [contractState, setContractState] = useState<any>({});

  const refreshData = useCallback(async () => {
    try {
      const s: any = await readState();
      setContractState(s);
      if (s.__opted_in__ === true) setHasOptedIn(true);
      else if (s.__opted_in__ === false && activeAddress) setHasOptedIn(false);
    } catch (err) {
      console.error('Failed to fetch state:', err);
    }
  }, [readState, activeAddress]);

  useEffect(() => { refreshData(); }, [refreshData]);
  useEffect(() => {
    const unsub = onWalletReady(() => { refreshData(); });
    return unsub;
  }, [onWalletReady, refreshData]);

  const handleOptIn = async () => {
    if (!activeAddress) return;
    try {
      const res: any = await callMethod({ method: '__optIn__', args: [], app_id: APP_ID });
      if (res?.alreadyOptedIn) {
        setHasOptedIn(true);
      } else {
        setHasOptedIn(true);
      }
      await refreshData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/already opted|already opt/i.test(msg)) {
        setHasOptedIn(true);
        await refreshData();
      } else {
        console.error('Opt-in failed:', err);
      }
    }
  };
  ```

Output ONLY the complete App.tsx code. No markdown fences. No explanation."""

REACT_AGENT_USER_PROMPT = """Create a PREMIUM App.tsx for: {name} — {description}

CONTRACT SPECIFICATION:
{spec_json}

UI REQUIREMENTS:
{ui_requirements}

SDK CONTEXT (for ABI hints):
{docs_context}

CRITICAL — DEPLOYED APP ID: The contract is deployed at APP_ID = {app_id}.
You MUST NOT hardcode any other number. The useContract hook already exports APP_ID = {app_id}.
Import it: import {{ useContract, APP_ID }} from './hooks/useContract';

Output THE COMPLETE App.tsx (start with // UI STRATEGY):"""

FIX_CODE_SYSTEM_PROMPT = """You are a React code fixer. Output the ENTIRE fixed code. No explanation."""

MAX_RETRIES = 2

async def generate_react_frontend(
    template_type: str,
    spec: dict,
    package_id: str,
    contract_code: str,
    docs_context: list[str],
    arc32_spec: any = None
) -> ReactGenerationResult:
    """Generate Algorand React frontend."""
    logger.info("[REACT_AGENT] Starting Algorand frontend generation")

    user_prompt = REACT_AGENT_USER_PROMPT.format(
        name=spec.get("name", "MyDApp"),
        description=spec.get("description", ""),
        spec_json=json.dumps(spec, indent=2),
        ui_requirements=", ".join(spec.get("ui_requirements", [])) if isinstance(spec.get("ui_requirements"), list) else spec.get("ui_requirements", "standard dashboard"),
        docs_context="\n".join(docs_context[:5]) if docs_context else "No documentation context provided.",
        app_id=package_id
    )

    response = await generate_completion(
        system_prompt=REACT_AGENT_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        temperature=0.0,
        max_tokens=8000,
    )

    if not response:
        raise ReactGenerationError("LLM returned empty response")

    app_code = extract_react_code(response)
    
    # In a real implementation, we would also generate the useAlgorand hook.
    # For now, we'll return a basic structure.
    
    return build_file_structure(app_code, package_id, arc32_spec)

def extract_react_code(response: str) -> str:
    code_block = re.search(r'```(?:tsx?|jsx?|javascript|typescript)?\s*\n?([\s\S]*?)```', response)
    if code_block:
        return code_block.group(1).strip()
    
    # Fallback: look for React code pattern if markdown blocks are missing
    if "import " in response and "export " in response:
        start_idx = response.find("import ")
        code = response[start_idx:].strip()
        if "```" in code:
            code = code.split("```")[0].strip()
        return code
        
    return response.strip()

def generate_contract_sdk(arc32_spec: dict, package_id: str = "0") -> str:
    """Auto-generate a typed React hook from the ARC32 spec."""
    methods = []
    if arc32_spec:
        methods = arc32_spec.get("contract", {}).get("methods", []) or arc32_spec.get("methods", [])

    LIFECYCLE_METHODS = {
        "createApplication", "optInToApplication", "closeOutOfApplication",
        "updateApplication", "deleteApplication",
        # snake_case variants some models generate
        "create_application", "opt_in", "opt_in_to_application",
        "close_out", "close_out_of_application", "update_application", "delete_application"
    }
    
    def ts_type(arc_type: str) -> str:
        arc_type = str(arc_type)
        if arc_type.lower() in ("pay", "payment"):
            return "number"
        if "uint" in arc_type: return "number"
        if "bool" == arc_type: return "boolean"
        if "string" == arc_type: return "string"
        if "address" in arc_type: return "string"
        if "byte" in arc_type: return "string"
        return "any"

    def is_pay_type(arc_type: str) -> bool:
        return str(arc_type).lower() in ("pay", "payment")
        
    def camel_case(s: str) -> str:
        parts = s.split('_')
        return parts[0] + ''.join(word.capitalize() for word in parts[1:])

    lines = [
        "// AUTO-GENERATED from ARC32 — DO NOT EDIT",
        "import { useAlgorand } from './useAlgorand';",
        "",
        f"export const APP_ID = {package_id};",
        "",
        "export const useContract = () => {",
        "    const { callMethod, readState, loading, error, success } = useAlgorand();",
        "",
        "    return {"
    ]

    for m in methods:
        name = m.get("name", "")
        if not name or name in LIFECYCLE_METHODS:
            continue
        
        args = m.get("args", [])
        pay_args = [a for a in args if is_pay_type(a.get("type", ""))]
        abi_args = [a for a in args if not is_pay_type(a.get("type", ""))]

        ts_args = []
        app_args = []
        for i, a in enumerate(abi_args):
            arg_name = a.get("name") or f"arg{i}"
            if arg_name == 'class': arg_name = 'className'
            if arg_name == 'function': arg_name = 'fn'
            arg_type = ts_type(a.get("type", "any"))
            ts_args.append(f"{arg_name}: {arg_type}")
            app_args.append(arg_name)

        pay_param = ""
        if pay_args:
            pay_name = pay_args[0].get("name") or "amountMicroAlgos"
            if pay_name == 'class': pay_name = 'className'
            if pay_name == 'function': pay_name = 'fn'
            pay_param = f", {pay_name}: number"
            if pay_name not in [p.split(":")[0].strip() for p in ts_args]:
                ts_args.append(f"{pay_name}: number")

        ts_args_str = ", ".join(ts_args) if ts_args else ""
        app_args_str = ", ".join(app_args)
        camel_name = camel_case(name)
        pay_field = pay_args[0].get("name") if pay_args else "amountMicroAlgos"
        if pay_field == 'class': pay_field = 'className'
        if pay_field == 'function': pay_field = 'fn'

        lines.append(f"        // {name}({ts_args_str}{pay_param})")
        if pay_args:
            lines.append(f"        {camel_name}: async ({ts_args_str}) =>")
            lines.append(
                f"            callMethod({{ method: '{name}', args: [{app_args_str}], app_id: APP_ID, "
                f"payment: {{ amount: {pay_field} }} }}),"
            )
        else:
            sig = ts_args_str if ts_args_str else ""
            lines.append(f"        {camel_name}: async ({sig}) =>" if sig else f"        {camel_name}: async () =>")
            lines.append(f"            callMethod({{ method: '{name}', args: [{app_args_str}], app_id: APP_ID }}),")
        lines.append("")

    lines.extend([
        "        // Read on-chain state",
        "        readState: () => readState(APP_ID),",
        "",
        "        loading, error, success",
        "    };",
        "};"
    ])
    return "\n".join(lines)

def build_file_structure(app_code: str, package_id: str, arc32_spec: any = None) -> ReactGenerationResult:
    files = {
        "/App.tsx": app_code,
        "/index.css": DEFAULT_CSS,
        "/hooks/useAlgorand.ts": USE_ALGORAND_HOOK_TEMPLATE,
        "/hooks/useContractState.ts": USE_CONTRACT_STATE_HOOK_TEMPLATE,
    }
    
    if arc32_spec:
        files["/contract.arc32.json"] = json.dumps(arc32_spec, indent=2)
    
    # Always generate the SDK file to prevent import crashes
    sdk_code = generate_contract_sdk(arc32_spec or {}, package_id)
    files["/hooks/useContract.ts"] = sdk_code
        
    return ReactGenerationResult(files=files)

DEFAULT_CSS = """
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: #0f172a;
  color: #f8fafc;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

input, textarea, select {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  color: white;
  font-family: inherit;
  font-size: 0.95rem;
  width: 100%;
  transition: border-color 0.2s, box-shadow 0.2s;
  outline: none;
}

input:focus, textarea:focus, select:focus {
  border-color: #f59e0b;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15);
}

input::placeholder, textarea::placeholder { color: #475569; }

button {
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s;
}

button:disabled { opacity: 0.5; cursor: not-allowed; }

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.2);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.fade-in { animation: fadeIn 0.4s ease-out; }
"""

USE_ALGORAND_HOOK_TEMPLATE = """
import { useState, useCallback, useEffect, useRef } from 'react';

const requestAddress = () =>
  new Promise<string>((resolve) => {
    const id = 'get_addr_' + Math.random().toString(36).slice(2);
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve('');
    }, 5000);
    const handler = (e: MessageEvent) => {
      if (e.data?.id === id && e.data?.type === 'ALGOCRAFT_RESPONSE') {
        clearTimeout(timeout);
        window.removeEventListener('message', handler);
        resolve(e.data.result?.address || '');
      }
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({ id, type: 'GET_ADDRESS' }, '*');
  });

export const useAlgorand = () => {
    const [activeAddress, setActiveAddress] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const activeAddressRef = useRef('');
    const walletChangeListeners = useRef<(() => void)[]>([]);

    useEffect(() => {
        activeAddressRef.current = activeAddress;
    }, [activeAddress]);

    useEffect(() => {
        const handleEvent = (event: MessageEvent) => {
            if (event.data?.type === 'ALGOCRAFT_RESPONSE' && event.data.result?.address !== undefined) {
                const addr = event.data.result.address || '';
                setActiveAddress(addr);
                activeAddressRef.current = addr;
                walletChangeListeners.current.forEach((fn) => fn());
            }
            if (event.data?.type === 'ALGOCRAFT_EVENT' && event.data.event === 'WALLET_CHANGED') {
                const addr = event.data.payload?.address || '';
                setActiveAddress(addr);
                activeAddressRef.current = addr;
                walletChangeListeners.current.forEach((fn) => fn());
            }
        };
        window.addEventListener('message', handleEvent);
        requestAddress().then((addr) => {
            if (addr) {
                setActiveAddress(addr);
                activeAddressRef.current = addr;
            }
        });
        return () => window.removeEventListener('message', handleEvent);
    }, []);

    const callMethod = useCallback(async ({ 
      method, 
      args = [], 
      app_id,
      payment
    }: { 
      method: string, 
      args?: any[], 
      app_id: number | string,
      payment?: { amount: number }
    }) => {
        setLoading(true);
        setError(null);
        setSuccess(null);

        const normalizedArgs = args.map((a) => (typeof a === 'bigint' ? Number(a) : a));
        
        return new Promise((resolve, reject) => {
            const id = Math.random().toString(36).substring(7);
            const handleResponse = (e: MessageEvent) => {
                if (e.data?.id === id) {
                    window.removeEventListener('message', handleResponse);
                    setLoading(false);
                    if (e.data.error) {
                        setError(e.data.error);
                        reject(new Error(e.data.error));
                    } else {
                        setSuccess(`Successfully executed ${method}`);
                        resolve(e.data.result);
                    }
                }
            };
            window.addEventListener('message', handleResponse);
            window.parent.postMessage({ 
                id, 
                type: 'CALL_METHOD', 
                payload: { method, args: normalizedArgs, appId: app_id, payment } 
            }, '*');
        });
    }, []);

    const readState = useCallback(async (app_id: number | string) => {
        let address = activeAddressRef.current;
        if (!address) {
            address = await requestAddress();
            if (address) {
                setActiveAddress(address);
                activeAddressRef.current = address;
            }
        }
        return new Promise((resolve, reject) => {
            const id = 'read_' + Math.random().toString(36).substring(7);
            const handleResponse = (e: MessageEvent) => {
                if (e.data?.id === id) {
                    window.removeEventListener('message', handleResponse);
                    if (e.data.error) reject(new Error(e.data.error));
                    else resolve(e.data.result);
                }
            };
            window.addEventListener('message', handleResponse);
            window.parent.postMessage({ 
                id, 
                type: 'READ_STATE', 
                payload: { appId: app_id, address: address || undefined } 
            }, '*');
        });
    }, []);

    const onWalletReady = useCallback((fn: () => void) => {
        walletChangeListeners.current.push(fn);
        if (activeAddressRef.current) fn();
        return () => {
            walletChangeListeners.current = walletChangeListeners.current.filter((f) => f !== fn);
        };
    }, []);

    return { 
      activeAddress, 
      callMethod, 
      readState,
      onWalletReady,
      loading, 
      error, 
      success 
    };
};
"""

USE_CONTRACT_STATE_HOOK_TEMPLATE = """
import { useState, useEffect, useCallback } from 'react';
import { useAlgorand } from './useAlgorand';

export const useContractState = (app_id: number | string) => {
    const { readState, onWalletReady } = useAlgorand();
    const [state, setState] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!app_id || app_id === "0") return;
        try {
            const data = await readState(app_id);
            setState(data as any);
            setError(null);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [app_id, readState]);

    useEffect(() => {
        refresh();
        const interval = setInterval(refresh, 5000);
        return () => clearInterval(interval);
    }, [refresh]);

    useEffect(() => {
        const unsub = onWalletReady(() => { refresh(); });
        return unsub;
    }, [onWalletReady, refresh]);

    return { state, loading, error, refresh };
};
"""

FIX_FRONTEND_SYSTEM_PROMPT = """You fix React/TypeScript files for an Algorand DApp Sandpack preview.

Output ONLY valid JSON (no markdown fences):
{"files": {"/App.tsx": "full file content", "/hooks/useContract.ts": "..."}}

Rules:
- Include ONLY files you changed. Paths must start with /.
- Do NOT modify contract source (.py, .algo.ts) or contract.arc32.json unless the user explicitly asks.
- Preserve APP_ID in useContract.ts and existing hook method names unless fixing a bug requires changes.
- Fix compile/runtime errors (duplicate param names, bad imports, TypeScript errors).
- Apply the user's requested UI or logic changes in App.tsx and related components."""

FRONTEND_FIX_EXTENSIONS = (".tsx", ".ts", ".css", ".jsx", ".js")
CONTRACT_SOURCE_SUFFIXES = (".py", ".algo.ts")


def _normalize_path(path: str) -> str:
    p = path.replace("\\", "/")
    return p if p.startswith("/") else f"/{p}"


def _is_frontend_fix_target(path: str) -> bool:
    p = _normalize_path(path).lower()
    if "contract.arc32" in p:
        return False
    if any(p.endswith(s) for s in CONTRACT_SOURCE_SUFFIXES):
        return False
    return any(p.endswith(ext) for ext in FRONTEND_FIX_EXTENSIONS)


def sanitize_use_contract_ts(code: str) -> str:
    """Remove duplicate parameter names in async arrow signatures (e.g. payment twice)."""
    def dedupe_params(match: re.Match) -> str:
        params = match.group(1)
        parts = [p.strip() for p in params.split(",") if p.strip()]
        seen: set[str] = set()
        unique: list[str] = []
        for part in parts:
            name_m = re.match(r"(\w+)\s*:", part)
            if not name_m:
                unique.append(part)
                continue
            name = name_m.group(1)
            if name in seen:
                if name == "payment":
                    part = re.sub(r"^payment\s*:", "amountMicroAlgos:", part)
                    name = "amountMicroAlgos"
                else:
                    suffix = 2
                    new_name = f"{name}{suffix}"
                    while new_name in seen:
                        suffix += 1
                        new_name = f"{name}{suffix}"
                    part = re.sub(r"^\w+\s*:", f"{new_name}:", part)
                    name = new_name
            seen.add(name)
            unique.append(part)
        return f"async ({', '.join(unique)}) =>"

    return re.sub(r"async\s*\(([^)]*)\)\s*=>", dedupe_params, code)


def _apply_deterministic_fixes(files: Dict[str, str]) -> Dict[str, str]:
    out = dict(files)
    for path, content in list(out.items()):
        norm = _normalize_path(path)
        if norm.endswith("useContract.ts") or path.endswith("useContract.ts"):
            fixed = sanitize_use_contract_ts(content)
            if fixed != content:
                out[path] = fixed
                if norm != path:
                    out[norm] = fixed
    return out


def _filter_frontend_files(files: Dict[str, str]) -> Dict[str, str]:
    return {p: c for p, c in files.items() if _is_frontend_fix_target(p)}


def _parse_fix_response(response: str) -> Dict[str, str]:
    text = response.strip()
    json_match = re.search(r"\{[\s\S]*\}", text)
    if json_match:
        text = json_match.group(0)
    data = json.loads(text)
    patched = data.get("files") if isinstance(data, dict) else None
    if not isinstance(patched, dict):
        raise ReactGenerationError("LLM fix response missing 'files' object")
    return {_normalize_path(k): str(v) for k, v in patched.items()}


async def fix_frontend_files(
    files: Dict[str, str],
    user_prompt: str,
    preview_error: Optional[str] = None,
    app_id: Optional[str] = None,
) -> Dict[str, str]:
    """Patch frontend files from user follow-up + optional Sandpack/compile error."""
    base = _apply_deterministic_fixes(files)
    frontend_subset = _filter_frontend_files(base)
    if not frontend_subset:
        raise ReactGenerationError("No frontend files to fix")

    # Fast path: only sanitize when user asks to fix a known duplicate-param error
    if preview_error and "Argument name clash" in preview_error and not user_prompt.strip():
        return base

    files_blob = "\n\n".join(
        f"### {_normalize_path(path)}\n```\n{content[:12000]}\n```"
        for path, content in frontend_subset.items()
    )
    user_parts = [f"USER REQUEST:\n{user_prompt}"]
    if preview_error:
        user_parts.append(f"PREVIEW/COMPILE ERROR:\n{preview_error[:4000]}")
    if app_id:
        user_parts.append(f"DEPLOYED APP_ID (do not change): {app_id}")
    user_parts.append(f"CURRENT FRONTEND FILES:\n{files_blob}")

    response = await generate_completion(
        system_prompt=FIX_FRONTEND_SYSTEM_PROMPT,
        user_prompt="\n\n".join(user_parts),
        temperature=0.1,
        max_tokens=16000,
    )
    if not response:
        raise ReactGenerationError("LLM returned empty fix response")

    try:
        changed = _parse_fix_response(response)
    except (json.JSONDecodeError, ReactGenerationError) as e:
        logger.warning("[REACT_AGENT] Fix JSON parse failed, retrying with stricter prompt: %s", e)
        retry = await generate_completion(
            system_prompt=FIX_FRONTEND_SYSTEM_PROMPT + "\n\nCRITICAL: Output raw JSON only. No prose.",
            user_prompt="\n\n".join(user_parts),
            temperature=0.0,
            max_tokens=16000,
        )
        if not retry:
            raise ReactGenerationError("LLM returned empty fix response on retry") from e
        changed = _parse_fix_response(retry)

    merged = dict(base)
    for path, content in changed.items():
        if not _is_frontend_fix_target(path):
            continue
        merged[path] = content
        no_slash = path.lstrip("/")
        if no_slash != path:
            merged[no_slash] = content

    return _apply_deterministic_fixes(merged)
