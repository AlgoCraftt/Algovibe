'use client'

import React, { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import JSZip from 'jszip'
import { useAlgoCraftStore } from '@/lib/store'

export function ExportButton() {
  const { generatedFiles, contractId } = useAlgoCraftStore()
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const zip = new JSZip()
      
      // 1. App Code & Styles
      zip.file('src/App.tsx', generatedFiles['/App.tsx'] || generatedFiles['/App.jsx'] || '')
      zip.file('src/index.css', generatedFiles['/index.css'] || '')
      
      // 2. Main Entry Point
      zip.file('src/main.tsx', `
import React from 'react'
import ReactDOM from 'react-dom/client'
import { WalletProvider, NetworkId, useWallet } from '@txnlab/use-wallet-react'
import { WalletManager } from '@txnlab/use-wallet'
import App from './App'
import './index.css'

const walletManager = new WalletManager({
  wallets: [], // Add Pera/Defly/etc here in production
  network: NetworkId.TESTNET
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WalletProvider manager={walletManager}>
      <App />
    </WalletProvider>
  </React.StrictMode>,
)
`.trim())

      zip.file('index.html', `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AlgoCraft Generated DApp</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`.trim())

      // 3. Standalone Hooks (REAL versions using algosdk)
      zip.file('src/hooks/useAlgorand.ts', `
import { useState, useCallback, useMemo } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import algosdk from 'algosdk';

const ALGOD_SERVER = 'https://testnet-api.algonode.cloud';
const ALGOD_TOKEN = '';
const ALGOD_PORT = 443;

export const useAlgorand = () => {
    const { signer, activeAddress } = useWallet();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const algodClient = useMemo(() => new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT), []);

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
        if (!activeAddress || !signer) {
          throw new Error("Wallet not connected");
        }
        
        setLoading(true);
        setError(null);
        setSuccess(null);
        
        try {
            const params = await algodClient.getTransactionParams().do();
            
            // Note: In production, you would load the contract ARC32 spec here 
            // and use algosdk.ABIContract to properly encode arguments.
            
            const txn = algosdk.makeApplicationCallTxnFromObject({
                sender: activeAddress,
                appIndex: Number(app_id),
                onComplete: algosdk.OnApplicationComplete.NoOpOC,
                appArgs: [new TextEncoder().encode(method), ...args.map(a => new TextEncoder().encode(String(a)))],
                suggestedParams: params,
            });

            let txns = [txn];
            if (payment) {
              const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
                sender: activeAddress,
                receiver: algosdk.getApplicationAddress(Number(app_id)),
                amount: payment.amount,
                suggestedParams: params,
              });
              txns = [payTxn, txn];
              algosdk.assignGroupID(txns);
            }

            const signed = await signer(txns, txns.map((_, i) => i));
            const { txId } = await algodClient.sendRawTransaction(signed).do();
            await algosdk.waitForConfirmation(algodClient, txId, 4);
            
            setSuccess(txId);
            return { txId };
        } catch (e: any) {
            setError(e.message);
            throw e;
        } finally {
            setLoading(false);
        }
    }, [activeAddress, signer, algodClient]);

    const readState = useCallback(async (app_id: number | string) => {
        const info = await algodClient.getApplicationByID(Number(app_id)).do();
        const state: Record<string, any> = {};
        (info.params['global-state'] || []).forEach((item: any) => {
            const key = Buffer.from(item.key, 'base64').toString();
            state[key] = item.value.type === 1 ? item.value.bytes : item.value.uint;
        });
        return state;
    }, [algodClient]);

    return { activeAddress, callMethod, readState, loading, error, success };
};
`.trim())

      zip.file('src/hooks/useContractState.ts', `
import { useState, useEffect } from 'react';
import { useAlgorand } from './useAlgorand';

export const useContractState = (app_id: number | string) => {
    const { readState } = useAlgorand();
    const [state, setState] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);

    const refresh = async () => {
        if (!app_id || app_id === "0") return;
        try {
            const data = await readState(app_id);
            setState(data as any);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
        const interval = setInterval(refresh, 5000);
        return () => clearInterval(interval);
    }, [app_id]);

    return { state, loading, refresh };
};
`.trim())

      // 4. Project Config
      zip.file('package.json', JSON.stringify({
        name: "algocraft-generated-dapp",
        private: true,
        version: "0.0.0",
        type: "module",
        scripts: {
          "dev": "vite",
          "build": "tsc && vite build",
          "preview": "vite preview"
        },
        dependencies: {
          "react": "^18.2.0",
          "react-dom": "^18.2.0",
          "algosdk": "^3.5.2",
          "@txnlab/use-wallet-react": "^4.6.0",
          "@txnlab/use-wallet": "^4.6.0",
          "lucide-react": "latest",
          "framer-motion": "latest"
        },
        devDependencies: {
          "@types/react": "^18.2.0",
          "@types/react-dom": "^18.2.0",
          "@vitejs/plugin-react": "^4.0.0",
          "typescript": "^5.0.0",
          "vite": "^4.3.0"
        }
      }, null, 2))

      zip.file('vite.config.ts', `
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
`.trim())

      zip.file('tsconfig.json', JSON.stringify({
        compilerOptions: {
          target: "ESNext",
          lib: ["DOM", "DOM.Iterable", "ESNext"],
          module: "ESNext",
          skipLibCheck: true,
          moduleResolution: "node",
          allowImportingTsExtensions: true,
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: "react-jsx",
          strict: true,
          noUnusedLocals: true,
          noUnusedParameters: true,
          noFallthroughCasesInSwitch: true
        },
        include: ["src"]
      }, null, 2))

      zip.file('README.md', `
# AlgoCraft Generated DApp

This project was generated by [AlgoCraft](https://algocraft.io).

## Setup

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Run development server:
   \`\`\`bash
   npm run dev
   \`\`\`

## Configuration

The contract ID is currently set to: \`${contractId}\`.
Check \`src/hooks/useAlgorand.ts\` to update the Algorand node configuration.
`.trim())

      // 5. Generate and download
      const content = await zip.generateAsync({ type: 'blob' })
      const url = window.URL.createObjectURL(content)
      const link = document.createElement('a')
      link.href = url
      link.download = `algocraft-dapp-${contractId || 'export'}.zip`
      link.click()
      window.URL.revokeObjectURL(url)

    } catch (err) {
      console.error("Export failed:", err)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={isExporting || Object.keys(generatedFiles).length === 0}
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-nb-gold text-background hover:opacity-90 transition-all text-[11px] font-black uppercase tracking-wider shadow-lg shadow-nb-gold/20 disabled:opacity-50 disabled:grayscale"
    >
      {isExporting ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Download className="w-3.5 h-3.5" />
      )}
      {isExporting ? 'Exporting...' : 'Export & Run'}
    </button>
  )
}
