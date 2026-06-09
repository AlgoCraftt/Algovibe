/**
 * Canonical Sandpack preview hooks (iframe ↔ parent BridgeHandler).
 * Injected on every preview render so older generated builds pick up bridge fixes.
 */

export const PREVIEW_USE_ALGORAND_TS = `
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
                walletChangeListeners.current.forEach((fn) => fn());
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
                        setSuccess(\`Successfully executed \${method}\`);
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
`.trim()

export const PREVIEW_USE_CONTRACT_STATE_TS = `
import { useState, useEffect, useCallback } from 'react';
import { useAlgorand } from './useAlgorand';

export const useContractState = (app_id: number | string) => {
    const { readState, onWalletReady, activeAddress } = useAlgorand();
    const [state, setState] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!app_id || app_id === "0") return;
        // Don't poll when tab is hidden (saves requests when user isn't looking)
        if (typeof document !== 'undefined' && document.hidden) return;
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
        const interval = setInterval(refresh, 15000);
        // Pause polling when tab is hidden
        const handleVisibility = () => { if (!document.hidden) refresh(); };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [refresh]);

    useEffect(() => {
        const unsub = onWalletReady(() => { refresh(); });
        return unsub;
    }, [onWalletReady, refresh]);

    return { state, loading, error, refresh };
};
`.trim()

const HOOK_PATHS = [
  '/hooks/useAlgorand.ts',
  'hooks/useAlgorand.ts',
  '/hooks/useContractState.ts',
  'hooks/useContractState.ts',
]

/**
 * Canonical preview version of useX402Client.ts with the x402 server URL baked in.
 * This does the REAL spec-compliant x402 flow:
 *   fetch(serverUrl) → 402 → SIGN_X402_PAYMENT via bridge → retry with X-PAYMENT → real response
 */
function buildPreviewX402ClientHook(serverUrl: string): string {
  return `// [AlgoVibe Preview] x402 client — delegates the full round trip to the parent window.
// The iframe runs on a public origin (codesandbox.io) which the browser blocks
// from reaching localhost. The parent window does fetch → 402 → sign → retry.
import { useState, useCallback } from 'react';
import { useAlgorand } from './useAlgorand';

const X402_SERVER_URL = ${JSON.stringify(serverUrl)};

function x402Fetch(url: string, options?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = 'x402fetch_' + Math.random().toString(36).slice(2);
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error('x402 request timed out — is your wallet connected and the server running?'));
    }, 90000);
    const handler = (e: MessageEvent) => {
      if (e.data?.id === id && e.data?.type === 'ALGOCRAFT_RESPONSE') {
        clearTimeout(timeout);
        window.removeEventListener('message', handler);
        if (e.data.error) reject(new Error(e.data.error));
        else resolve(e.data.result);
      }
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({ id, type: 'X402_FETCH', payload: { url, options } }, '*');
  });
}

export const useX402Client = () => {
  const { activeAddress } = useAlgorand();
  const [paying, setPaying] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<any>(null);
  const [lastResponse, setLastResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const payAndFetch = useCallback(async (_url?: string, options?: RequestInit) => {
    if (!activeAddress) {
      setError('Connect your wallet to make paid API calls');
      throw new Error('Wallet not connected');
    }

    console.log('[x402] Requesting parent to fetch:', X402_SERVER_URL);
    setPaying(true);
    setError(null);
    setLastResponse(null);

    try {
      // Delegate the entire x402 round trip to the parent window (bridge)
      const result: any = await x402Fetch(X402_SERVER_URL, {
        method: (options as any)?.method,
        headers: (options as any)?.headers,
        body: (options as any)?.body,
      });

      if (result?.receipt) setLastReceipt(result.receipt);
      if (result?.data) setLastResponse(result.data);
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setPaying(false);
    }
  }, [activeAddress]);

  return { payAndFetch, paying, lastReceipt, lastResponse, error, config: { serverUrl: X402_SERVER_URL } };
};
`
}

/** Ensure preview iframe always uses latest bridge hooks (fixes opt-in without re-export). */
export function patchPreviewBridgeFiles(files: Record<string, string>): Record<string, string> {
  const out = { ...files }
  const hasHooks = Object.keys(out).some((p) => p.includes('useAlgorand'))
  if (!hasHooks) return out

  // Fix #2: Patch ANY path containing these hook names (not just hardcoded paths)
  // LLM sometimes generates hooks at /lib/useAlgorand.ts, /src/hooks/useAlgorand.ts, etc.
  for (const p of Object.keys(out)) {
    if (p.includes('useAlgorand') && !p.includes('useAlgorandProvider') && p.endsWith('.ts')) {
      out[p] = PREVIEW_USE_ALGORAND_TS
    }
    if (p.includes('useContractState') && p.endsWith('.ts')) {
      out[p] = PREVIEW_USE_CONTRACT_STATE_TS
    }
  }
  // Also ensure the canonical paths exist (for imports that reference them)
  for (const p of HOOK_PATHS) {
    if (p.includes('useAlgorand')) {
      out[p] = PREVIEW_USE_ALGORAND_TS
    }
    if (p.includes('useContractState')) {
      out[p] = PREVIEW_USE_CONTRACT_STATE_TS
    }
  }

  // Inject x402 server URL — replace the ENTIRE useX402Client hook with a
  // preview version that has the configured server URL baked in.
  // (sessionStorage is accessible here because this runs in the PARENT window)
  try {
    const raw = sessionStorage.getItem('algovibe_x402_settings')
    if (raw) {
      const settings = JSON.parse(raw)
      if (settings?.serverUrl && settings?.endpoint) {
        const base = settings.serverUrl.replace(/\/$/, '')
        const path = settings.endpoint.startsWith('/') ? settings.endpoint : '/' + settings.endpoint
        const fullUrl = base + path
        const previewHook = buildPreviewX402ClientHook(fullUrl)

        // Replace every useX402Client file (with or without leading slash)
        for (const p of Object.keys(out)) {
          if (p.includes('useX402Client')) {
            out[p] = previewHook
          }
        }
      }
    }
  } catch {
    // No x402 settings or parse error — skip injection
  }

  return out
}
