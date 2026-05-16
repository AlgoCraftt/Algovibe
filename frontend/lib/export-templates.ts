/** Standalone export templates — wallet-ready Vite project (Pera, Defly, Exodus, Lute) */

export const EXPORT_MAIN_TS = `
import React from 'react'
import ReactDOM from 'react-dom/client'
import { Buffer } from 'buffer'
import { WalletProvider, NetworkId, WalletId, WalletManager } from '@txnlab/use-wallet-react'
import App from './App'
import { AppShell } from './components/AppShell'
import './index.css'

if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer
}

const walletManager = new WalletManager({
  wallets: [WalletId.PERA, WalletId.DEFLY, WalletId.EXODUS, WalletId.LUTE],
  defaultNetwork: NetworkId.TESTNET,
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WalletProvider manager={walletManager}>
      <AppShell>
        <App />
      </AppShell>
    </WalletProvider>
  </React.StrictMode>,
)
`.trim()

export const EXPORT_WALLET_CONNECT_TS = `
import { useState, useEffect, useRef } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';

function truncate(addr: string) {
  return addr.length > 12 ? \`\${addr.slice(0, 6)}...\${addr.slice(-4)}\` : addr;
}

export function WalletConnect() {
  const { wallets, activeAddress, activeWallet } = useWallet();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) {
      document.addEventListener('mousedown', onDoc);
      return () => document.removeEventListener('mousedown', onDoc);
    }
  }, [open]);

  const copy = () => {
    if (!activeAddress) return;
    navigator.clipboard.writeText(activeAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (activeAddress) {
    return (
      <div ref={ref} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            borderRadius: '999px',
            border: '1px solid rgba(34, 197, 94, 0.4)',
            background: 'rgba(34, 197, 94, 0.12)',
            color: '#4ade80',
            fontWeight: 700,
            fontSize: '0.8rem',
            cursor: 'pointer',
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }} />
          <span style={{ fontFamily: 'ui-monospace, monospace' }}>{truncate(activeAddress)}</span>
          <span style={{ opacity: 0.7 }}>▾</span>
        </button>
        {open && (
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 'calc(100% + 8px)',
              width: 280,
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '12px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
              zIndex: 1000,
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '1rem', borderBottom: '1px solid #334155' }}>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                Connected · {activeWallet?.metadata?.name || 'Wallet'}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <code style={{ fontSize: '0.7rem', color: '#e2e8f0', wordBreak: 'break-all', flex: 1 }}>{activeAddress}</code>
                <button type="button" onClick={copy} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#94a3b8', cursor: 'pointer', fontSize: '0.7rem' }}>
                  {copied ? '✓' : 'Copy'}
                </button>
              </div>
            </div>
            <div style={{ padding: 8 }}>
              <button
                type="button"
                onClick={() => { activeWallet?.disconnect(); setOpen(false); }}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: 8,
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  background: 'rgba(239, 68, 68, 0.08)',
                  color: '#f87171',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.6rem 1.25rem',
          borderRadius: '10px',
          border: 'none',
          background: '#f59e0b',
          color: '#000',
          fontWeight: 800,
          fontSize: '0.85rem',
          cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
        }}
      >
        Connect Wallet ▾
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: 220,
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '12px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            zIndex: 1000,
            padding: 8,
          }}
        >
          <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '8px 8px 4px' }}>
            Select wallet
          </div>
          {wallets.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => { w.connect(); setOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '10px 12px',
                marginTop: 4,
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#334155'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              {w.metadata?.icon ? (
                <img src={w.metadata.icon} alt="" width={20} height={20} style={{ borderRadius: 4 }} />
              ) : (
                <span style={{ width: 20, height: 20, background: '#475569', borderRadius: 4 }} />
              )}
              {w.metadata?.name || w.id}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
`.trim()

export const EXPORT_APP_SHELL_TS = `
import { ReactNode } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import { WalletConnect } from './WalletConnect';
import { APP_ID } from '../hooks/useContract';

type Props = { children: ReactNode };

export function AppShell({ children }: Props) {
  const { activeAddress } = useWallet();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0f172a' }}>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '0.75rem 1.5rem',
          borderBottom: '1px solid #1e293b',
          background: 'rgba(15, 23, 42, 0.92)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 900,
              color: '#000',
              fontSize: '1rem',
              flexShrink: 0,
            }}
          >
            A
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, color: '#f59e0b', fontSize: '0.95rem', letterSpacing: '-0.02em' }}>
              AlgoCraft DApp
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
              Testnet · App {APP_ID}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
          <span
            style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#94a3b8',
              padding: '0.35rem 0.65rem',
              borderRadius: 999,
              border: '1px solid #334155',
              background: '#1e293b',
            }}
          >
            Algorand
          </span>
          <WalletConnect />
        </div>
      </header>

      {!activeAddress && (
        <div
          style={{
            margin: '1rem 1.5rem 0',
            padding: '1rem 1.25rem',
            borderRadius: 12,
            border: '1px solid rgba(245, 158, 11, 0.35)',
            background: 'rgba(245, 158, 11, 0.08)',
            color: '#fcd34d',
            fontSize: '0.9rem',
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: '#f59e0b' }}>Connect your wallet</strong> using the button above to sign
          transactions (opt-in, votes, and contract calls). Pera, Defly, Exodus, and Lute are supported.
        </div>
      )}

      <main style={{ flex: 1, minHeight: 0 }}>{children}</main>
    </div>
  );
}
`.trim()

export const EXPORT_USE_CONTRACT_STATE_TS = `
import { useState, useEffect, useCallback } from 'react';
import { useAlgorand } from './useAlgorand';

export const useContractState = (app_id: number | string) => {
  const { readState, onWalletReady } = useAlgorand();
  const [state, setState] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!app_id || app_id === '0') return;
    try {
      const data = await readState(app_id);
      setState(data as Record<string, unknown>);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
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

export const EXPORT_INDEX_CSS = `
* { box-sizing: border-box; }
html, body, #root { margin: 0; min-height: 100%; }
body {
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
}
button, input { font: inherit; }
`.trim()

export const EXPORT_VITE_CONFIG = `
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: { global: 'globalThis' },
  resolve: { alias: { buffer: 'buffer' } },
})
`.trim()

export const EXPORT_VITE_ENV = `/// <reference types="vite/client" />`

export const EXPORT_USE_ALGORAND_TS = `
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import algosdk from 'algosdk';
import arc32Spec from '../contract.arc32.json';
import { readApplicationState } from '../lib/algorand-state';

const ALGOD_SERVER = 'https://testnet-api.algonode.cloud';
const ALGOD_TOKEN = '';
const ALGOD_PORT = 443;

function sameAppId(a: unknown, b: unknown): boolean {
  return Number(a) === Number(b);
}

function getMethodOnComplete(methodName: string): number {
  const methods = (arc32Spec as any).contract?.methods || (arc32Spec as any).methods || [];
  const methodDef = methods.find((m: any) => m.name === methodName);
  if (!methodDef) return algosdk.OnApplicationComplete.NoOpOC;
  const argsSig = (methodDef.args || []).map((a: any) => a.type).join(',');
  const retSig = methodDef.returns?.type ?? 'void';
  const hintKey = \`\${methodName}(\${argsSig})\${retSig}\`;
  const hint = (arc32Spec as any).hints?.[hintKey];
  if (hint?.call_config?.opt_in === 'CALL') {
    return algosdk.OnApplicationComplete.OptInOC;
  }
  return algosdk.OnApplicationComplete.NoOpOC;
}

export const useAlgorand = () => {
  const { transactionSigner, activeAddress } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const walletChangeListeners = useRef<(() => void)[]>([]);

  useEffect(() => {
    walletChangeListeners.current.forEach((fn) => fn());
  }, [activeAddress]);

  const algodClient = useMemo(
    () => new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT),
    []
  );

  const contract = useMemo(() => {
    try {
      const methods = (arc32Spec as any).contract?.methods || (arc32Spec as any).methods || [];
      const name = (arc32Spec as any).contract?.name || (arc32Spec as any).name || 'Contract';
      return new algosdk.ABIContract({ name, methods });
    } catch {
      return null;
    }
  }, []);

  const callMethod = useCallback(
    async ({
      method,
      args = [],
      app_id,
      payment,
    }: {
      method: string;
      args?: any[];
      app_id: number | string;
      payment?: { amount: number };
    }) => {
      if (!activeAddress || !transactionSigner) throw new Error('Wallet not connected');
      if (!contract) throw new Error('Contract spec not loaded');

      setLoading(true);
      setError(null);
      setSuccess(null);

      try {
        const params = await algodClient.getTransactionParams().do();
        const appId = Number(app_id);

        if (method === '__optIn__') {
          const accountInfo = await algodClient.accountInformation(activeAddress).do();
          const local = (accountInfo as any)['apps-local-state'] || [];
          if (local.some((a: any) => sameAppId(a.id, appId))) {
            return { alreadyOptedIn: true };
          }
          const optInMethod = (arc32Spec as any).contract?.methods?.find(
            (m: any) => m.name === 'optInToApplication'
          );
          let appArgs: Uint8Array[] | undefined;
          if (optInMethod) {
            const m = contract.getMethodByName('optInToApplication');
            appArgs = [m.getSelector()];
          }
          const txn = algosdk.makeApplicationOptInTxnFromObject({
            sender: activeAddress,
            appIndex: appId,
            suggestedParams: params,
            appArgs,
          });
          const signed = await transactionSigner([txn], [0]);
          const resp = await algodClient.sendRawTransaction(signed[0]).do();
          const txId = (resp as any).txId || (resp as any).txid || '';
          await algosdk.waitForConfirmation(algodClient, txId, 10);
          setSuccess(txId);
          return { txId };
        }

        const abiMethod = contract.getMethodByName(method);
        const appArgs: Uint8Array[] = [abiMethod.getSelector()];
        args.forEach((arg, i) => {
          const typeStr = abiMethod.args[i]?.type.toString() ?? '';
          if (typeStr === 'uint64' || typeStr.startsWith('uint')) {
            appArgs.push(algosdk.encodeUint64(BigInt(arg)));
          } else if (typeStr === 'bool') {
            appArgs.push(algosdk.encodeUint64(BigInt(arg ? 1 : 0)));
          } else if (typeStr === 'address' || typeStr === 'Account') {
            try {
              appArgs.push(algosdk.decodeAddress(String(arg)).publicKey);
            } catch {
              appArgs.push(new TextEncoder().encode(String(arg)));
            }
          } else if (typeStr === 'string') {
            const enc = new TextEncoder().encode(String(arg));
            const buf = new Uint8Array(2 + enc.length);
            new DataView(buf.buffer).setUint16(0, enc.length);
            buf.set(enc, 2);
            appArgs.push(buf);
          } else {
            appArgs.push(new TextEncoder().encode(String(arg)));
          }
        });

        let onComplete = getMethodOnComplete(method);
        if (onComplete === algosdk.OnApplicationComplete.OptInOC) {
          const accountInfo = await algodClient.accountInformation(activeAddress).do();
          const local = (accountInfo as any)['apps-local-state'] || [];
          if (local.some((a: any) => sameAppId(a.id, appId))) {
            onComplete = algosdk.OnApplicationComplete.NoOpOC;
          }
        }

        const txn = algosdk.makeApplicationCallTxnFromObject({
          sender: activeAddress,
          appIndex: appId,
          onComplete,
          appArgs,
          suggestedParams: params,
        });

        let txns = [txn];
        if (payment) {
          const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            sender: activeAddress,
            receiver: algosdk.getApplicationAddress(appId),
            amount: payment.amount,
            suggestedParams: params,
          });
          txns = [payTxn, txn];
          algosdk.assignGroupID(txns);
        }

        const signed = await transactionSigner(txns, txns.map((_, i) => i));
        const total = signed.reduce((a, b) => a + b.length, 0);
        const bytes = new Uint8Array(total);
        let off = 0;
        for (const b of signed) {
          bytes.set(b, off);
          off += b.length;
        }

        const resp = await algodClient.sendRawTransaction(bytes).do();
        const txId = (resp as any).txId || (resp as any).txid || '';
        await algosdk.waitForConfirmation(algodClient, txId, 10);

        setSuccess(txId);
        return { txId };
      } catch (e: any) {
        setError(e.message);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [activeAddress, transactionSigner, algodClient, contract]
  );

  const readState = useCallback(
    async (app_id: number | string) => {
      return readApplicationState(
        algodClient,
        app_id,
        activeAddress ?? null,
        arc32Spec as any
      );
    },
    [algodClient, activeAddress]
  );

  const onWalletReady = useCallback((fn: () => void) => {
    walletChangeListeners.current.push(fn);
    if (activeAddress) fn();
    return () => {
      walletChangeListeners.current = walletChangeListeners.current.filter((f) => f !== fn);
    };
  }, [activeAddress]);

  return { activeAddress, callMethod, readState, onWalletReady, loading, error, success };
};
`.trim()
