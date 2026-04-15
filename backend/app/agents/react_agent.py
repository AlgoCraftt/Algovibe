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

REACT_AGENT_SYSTEM_PROMPT = """You are a Senior Frontend Engineer at AlgoCraft, specialized in premium Algorand blockchain applications. You generate HIGH-FIDELITY App.tsx for Algorand DApps.

STRATEGIC UI PLANNING:
Your code MUST start with a `// UI STRATEGY` comment block that explains:
1.  How the contract state is mapped to the dashboard.
2.  How each method (from the specification) is represented as an interactive action.
3.  The layout choice (e.g. Dashboard with metrics + Actions grid).

AESTHETIC GUIDELINES (AlgoCraft Premium):
-   Theme: Midnight Blue (#0f172a) and Golden Amber (#f59e0b).
-   Layout: Center-focused dashboard with a glassmorphism feel.
-   Elements: Use gradients, subtle borders, and consistent grouping.
-   Icons: Use `lucide-react` for ALL primary actions (e.g. `Wallet`, `PlusCircle`, `ArrowUpRight`, `Lock`).

TECHNICAL STACK:
-   React (hooks: useState, useEffect, useCallback)
-   @txnlab/use-wallet (useWallet hook for address/signer)
-   algosdk (Algodv2 for client-side state)
-   Custom external hook: `useAlgorand()` which provides `{ callMethod, loading, error, success }`.

RULES:
-   Import: `import { useState, useEffect, useCallback } from 'react'`, `import { useWallet } from '@txnlab/use-wallet'`, `import { useContract } from './hooks/useContract'`, `import './index.css'`, `import { Wallet, Info, CheckCircle, AlertCircle } from 'lucide-react'`
-   API: YOU MUST IMPORT AND USE `useContract()` from `./hooks/useContract`. NEVER call callMethod directly.
-   State Reading: Use `readState()` from `useContract()` to fetch on-chain state. Call it after any successful transaction.
-   Usage Example 1 (Voting):
    ```tsx
    const { castVote, readState, loading, error, success } = useContract();
    const handleVote = async (name: string) => {
        await castVote(name);
        await readState(); // Refresh dashboard
    };
    ```
-   Usage Example 2 (Counter):
    ```tsx
    const { increment, readState, loading } = useContract();
    const handleIncrement = async () => {
        await increment();
        await readState();
    };
    ```
-   Wallet Check: Never allow contract calls if `!activeAddress`. Show a "Connect Wallet" state in the hero section.

Output ONLY the complete TypeScript/JSX code (no markdown)."""

REACT_AGENT_USER_PROMPT = """Create a PREMIUM App.tsx for: {name} — {description}

CONTRACT SPECIFICATION:
{spec_json}

UI REQUIREMENTS:
{ui_requirements}

SDK CONTEXT (for ABI hints):
{docs_context}

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
        docs_context="\n".join(docs_context[:5]) if docs_context else "No documentation context provided."
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

def generate_contract_sdk(arc32_spec: dict) -> str:
    """Auto-generate a typed React hook from the ARC32 spec."""
    methods = []
    if arc32_spec:
        methods = arc32_spec.get("contract", {}).get("methods", []) or arc32_spec.get("methods", [])
    
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
        "import { APP_ID } from '/lib/algorand';",
        "",
        "export const useContract = () => {",
        "    const { callMethod, readState, loading, error, success } = useAlgorand();",
        "",
        "    return {"
    ]

    for m in methods:
        name = m.get("name", "")
        if not name or name == "createApplication": continue
        
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
    sdk_code = generate_contract_sdk(arc32_spec or {})
    files["/hooks/useContract.ts"] = sdk_code
        
    return ReactGenerationResult(files=files)

DEFAULT_CSS = """
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

:root {
  --bg: #0f172a;
  --surface: #1e293b;
  --surface-hover: #334155;
  --primary: #f59e0b;
  --primary-hover: #d97706;
  --secondary: #3b82f6;
  --text: #f8fafc;
  --text-muted: #94a3b8;
  --border: rgba(255, 255, 255, 0.1);
  --glass: rgba(255, 255, 255, 0.03);
  --glass-border: rgba(255, 255, 255, 0.1);
  --success: #10b981;
  --error: #ef4444;
}

* { box-sizing: border-box; }
body { 
  background-color: var(--bg);
  background-image: 
    radial-gradient(at 0% 0%, rgba(59, 130, 246, 0.15) 0px, transparent 50%),
    radial-gradient(at 100% 100%, rgba(245, 158, 11, 0.1) 0px, transparent 50%);
  color: var(--text);
  font-family: 'Inter', system-ui, sans-serif;
  margin: 0;
  line-height: 1.5;
  min-height: 100vh;
}

.app-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem 1rem;
  animation: fadeIn 0.5s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.glass-card {
  background: var(--glass);
  backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  border-radius: 1.5rem;
  padding: 2rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  margin-bottom: 2rem;
}

.hero-section {
  text-align: center;
  margin-bottom: 4rem;
}

.hero-title {
  font-size: 3rem;
  font-weight: 800;
  background: linear-gradient(to right, #fff, var(--primary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 1rem;
}

.hero-subtitle {
  color: var(--text-muted);
  font-size: 1.125rem;
  max-width: 600px;
  margin: 0 auto;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
}

.stat-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--border);
  padding: 1.5rem;
  border-radius: 1rem;
  text-align: center;
  transition: all 0.2s ease;
}

.stat-card:hover { border-color: var(--primary); transform: translateY(-2px); }
.stat-label { color: var(--text-muted); font-size: 0.875rem; font-weight: 500; margin-bottom: 0.5rem; }
.stat-value { font-size: 1.5rem; font-weight: 700; color: var(--primary); }

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.action-card {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.input-group { display: flex; flex-direction: column; gap: 0.5rem; }
.label { font-size: 0.875rem; font-weight: 600; color: var(--text-muted); }

.input {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  color: white;
  font-family: inherit;
  transition: all 0.2s;
}

.input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2); }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: var(--primary);
  color: #000;
  font-weight: 700;
  border: none;
  padding: 0.875rem 1.5rem;
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:hover { background: var(--primary-hover); transform: scale(1.02); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
.btn-secondary { background: var(--surface); color: white; border: 1px solid var(--border); }
.btn-secondary:hover { background: var(--surface-hover); }

.badge {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.badge-success { background: rgba(16, 185, 129, 0.1); color: var(--success); }
.badge-error { background: rgba(239, 68, 68, 0.1); color: var(--error); }

.tx-log {
  margin-top: 3rem;
  font-size: 0.875rem;
}

.tx-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid var(--border);
}

.tx-id { font-family: monospace; color: var(--secondary); text-decoration: none; }
"""

USE_ALGORAND_HOOK_TEMPLATE = """
import { useState, useCallback, useEffect } from 'react';

/**
 * AlgoCraft Bridge Hook
 * This hook sends requests to the parent AlgoCraft app via postMessage.
 * The parent app handles real wallet signing and blockchain interaction.
 */
export const useAlgorand = () => {
    const [activeAddress, setActiveAddress] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Initial address fetch and event listener
    useEffect(() => {
        const handleEvent = (event: MessageEvent) => {
            if (event.data?.type === 'ALGOCRAFT_RESPONSE' && event.data.result?.address !== undefined) {
                setActiveAddress(event.data.result.address);
            }
            if (event.data?.type === 'ALGOCRAFT_EVENT' && event.data.event === 'WALLET_CHANGED') {
                setActiveAddress(event.data.payload.address);
            }
        };
        window.addEventListener('message', handleEvent);
        window.parent.postMessage({ id: 'init_addr', type: 'GET_ADDRESS' }, '*');
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

    const readState = useCallback(async (app_id: number | string) => {
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
            window.parent.postMessage({ id, type: 'READ_STATE', payload: { appId: app_id } }, '*');
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
