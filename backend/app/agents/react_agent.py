"""
React Agent - Generates Algorand frontend code for DApps.

Generates premium React/TypeScript frontends connected to deployed
Algorand smart contracts using @txnlab/use-wallet and algosdk.
"""

import re
import logging
import json
from typing import TypedDict, Dict

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
2. Layout: Full-page dark dashboard. Top navbar with app name + wallet address pill. Main content in a centered max-width container.
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
- Call `readState()` after every successful transaction to refresh stats
- Guard all method calls with `if (!activeAddress) return` — show "Connect your wallet" message if not connected
- Each method call goes in its own async handler with try/catch
- CRITICAL — LOCAL STATE OPT-IN: If the contract spec has any `local_state` entries, you MUST implement an opt-in flow:
  1. On load, call `readState()` — it returns `{ __opted_in__: boolean, ...globalState }`. Check `state.__opted_in__`
  2. If `__opted_in__` is false or undefined, show a prominent "Opt In to App" card BEFORE showing any action buttons
  3. The opt-in button MUST call `callMethod({ method: '__optIn__', args: [], app_id: APP_ID })` from `useAlgorand()` — NEVER call `opt_in()` from `useContract()`, that does not exist
  4. After opt-in succeeds, set local state `hasOptedIn = true` and show the normal action UI
  5. CRITICAL: Use a `useRef` to track opt-in so `refreshData` never resets it back to false after a successful opt-in
  Example — COPY THIS EXACTLY:
  ```tsx
  const { activeAddress, callMethod } = useAlgorand();
  const { vote, readState, loading, error, success } = useContract();
  const [hasOptedIn, setHasOptedIn] = useState(false);
  const [contractState, setContractState] = useState<any>({});
  const optedInRef = useRef(false);

  const refreshData = useCallback(async () => {
    if (!activeAddress) return;
    try {
      const s: any = await readState();
      setContractState(s);
      // Only update opt-in from chain if chain says true, or ref not yet confirmed.
      // Prevents chain indexing lag from overwriting a just-confirmed opt-in.
      const chainOptedIn = !!s.__opted_in__;
      if (chainOptedIn || !optedInRef.current) {
        optedInRef.current = chainOptedIn;
        setHasOptedIn(chainOptedIn);
      }
    } catch {}
  }, [readState, activeAddress]);

  useEffect(() => { refreshData(); }, [refreshData]);

  useEffect(() => {
    optedInRef.current = false;
    setHasOptedIn(false);
  }, [activeAddress]);

  // Opt-in handler — optimistic update then chain confirmation
  const handleOptIn = async () => {
    if (!activeAddress) return;
    try {
      await callMethod({ method: '__optIn__', args: [], app_id: APP_ID });
      optedInRef.current = true;
      setHasOptedIn(true); // show voting UI immediately
      await refreshData(); // confirm from chain
    } catch (err) { console.error(err); }
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
        if "uint" in arc_type: return "number"
        if "bool" == arc_type: return "boolean"
        if "string" == arc_type: return "string"
        if "address" in arc_type: return "string"
        if "byte" in arc_type: return "string"
        return "any"
        
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
        ts_args = []
        app_args = []
        for i, a in enumerate(args):
            arg_name = a.get("name") or f"arg{i}"
            if arg_name == 'class': arg_name = 'className'
            if arg_name == 'function': arg_name = 'fn'
            arg_type = ts_type(a.get("type", "any"))
            ts_args.append(f"{arg_name}: {arg_type}")
            app_args.append(arg_name)
            
        ts_args_str = ", ".join(ts_args)
        app_args_str = ", ".join(app_args)
        camel_name = camel_case(name)
        
        lines.append(f"        // {name}({ts_args_str})")
        lines.append(f"        {camel_name}: async ({ts_args_str}) =>")
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

export const useAlgorand = () => {
    const [activeAddress, setActiveAddress] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const activeAddressRef = useRef('');

    useEffect(() => {
        activeAddressRef.current = activeAddress;
    }, [activeAddress]);

    useEffect(() => {
        const handleEvent = (event: MessageEvent) => {
            if (event.data?.type === 'ALGOCRAFT_RESPONSE' && event.data.result?.address !== undefined) {
                const addr = event.data.result.address || '';
                setActiveAddress(addr);
                activeAddressRef.current = addr;
            }
            if (event.data?.type === 'ALGOCRAFT_EVENT' && event.data.event === 'WALLET_CHANGED') {
                const addr = event.data.payload.address || '';
                setActiveAddress(addr);
                activeAddressRef.current = addr;
            }
        };
        window.addEventListener('message', handleEvent);
        setTimeout(() => {
            window.parent.postMessage({ id: 'init_addr', type: 'GET_ADDRESS' }, '*');
        }, 0);
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
                payload: { method, args, appId: app_id, payment } 
            }, '*');
        });
    }, []);

    // Always reads the latest address from ref — never stale
    const readState = useCallback(async (app_id: number | string) => {
        const address = activeAddressRef.current || undefined;
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
                payload: { appId: app_id, address } 
            }, '*');
        });
    }, []);

    return { 
      activeAddress, 
      callMethod, 
      readState,
      loading, 
      error, 
      success 
    };
};
"""

USE_CONTRACT_STATE_HOOK_TEMPLATE = """
import { useState, useEffect } from 'react';
import { useAlgorand } from './useAlgorand';

export const useContractState = (app_id: number | string) => {
    const { readState } = useAlgorand();
    const [state, setState] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = async () => {
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
    };

    useEffect(() => {
        refresh();
        const interval = setInterval(refresh, 5000);
        return () => clearInterval(interval);
    }, [app_id]);

    return { state, loading, error, refresh };
};
"""
