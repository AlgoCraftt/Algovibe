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
`.trim()

const HOOK_PATHS = [
  '/hooks/useAlgorand.ts',
  'hooks/useAlgorand.ts',
  '/hooks/useContractState.ts',
  'hooks/useContractState.ts',
]

/** Ensure preview iframe always uses latest bridge hooks (fixes opt-in without re-export). */
export function patchPreviewBridgeFiles(files: Record<string, string>): Record<string, string> {
  const out = { ...files }
  const hasHooks = Object.keys(out).some((p) => p.includes('useAlgorand'))
  if (!hasHooks) return out

  for (const p of HOOK_PATHS) {
    if (p.includes('useAlgorand')) {
      out[p] = PREVIEW_USE_ALGORAND_TS
      const slash = p.startsWith('/') ? p : `/${p}`
      if (slash !== p) out[slash] = PREVIEW_USE_ALGORAND_TS
    }
    if (p.includes('useContractState')) {
      out[p] = PREVIEW_USE_CONTRACT_STATE_TS
      const slash = p.startsWith('/') ? p : `/${p}`
      if (slash !== p) out[slash] = PREVIEW_USE_CONTRACT_STATE_TS
    }
  }
  return out
}
