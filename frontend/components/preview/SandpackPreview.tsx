'use client'

import '@/lib/sandpack-init'
import React, { Component, type ReactNode, useState, useMemo } from 'react'
import {
  SandpackProvider,
  SandpackPreview as SandpackPreviewComponent,
  SandpackCodeEditor,
  SandpackLayout,
  useSandpack,
} from '@codesandbox/sandpack-react'
import { Wallet, Globe, ExternalLink } from 'lucide-react'
import { loraApplicationUrl, visibleUserFiles } from '@/lib/sandpack-files'
import { BridgeHandler } from './BridgeHandler'
import { patchPreviewBridgeFiles } from '@/lib/preview-bridge-hooks'
import { patchGeneratedFrontendFiles } from '@/lib/fix-use-contract'
import { useAlgoCraftStore } from '@/lib/store'

interface SandpackPreviewProps {
  files: Record<string, string>
  contractId: string | null
  walletAddress?: string | null
  activeTab?: 'preview' | 'code'
  excludeBoilerplate?: boolean
  onDirtyChange?: (isDirty: boolean, currentFiles: Record<string, string>) => void
  activeFile?: string
  onActiveFileChange?: (path: string) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class SandpackErrorBoundary extends Component<
  { children: ReactNode; files: Record<string, string> },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; files: Record<string, string> }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Sandpack error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center p-6 text-center bg-neutral-900">
          <div className="rounded-xl bg-red-900/30 border border-red-500/30 p-6 max-w-lg">
            <h3 className="text-lg font-semibold text-red-400 mb-2">
              Preview Error
            </h3>
            <p className="text-sm text-red-300/80 mb-4">
              The live preview hit a runtime error. Check the message below or open the Code tab.
            </p>
            <div className="text-left bg-neutral-950 rounded-lg p-3 text-xs font-mono text-red-300 overflow-auto max-h-32">
              {this.state.error?.message || 'Unknown error'}
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const getDefaultFiles = (contractId: string | null, walletAddress?: string | null) => ({
  '/lib/algorand.ts': `export const ALGOD_SERVER = 'https://testnet-api.algonode.cloud';
export const ALGOD_TOKEN = '';
export const ALGOD_PORT = 443;
export const APP_ID = ${isNaN(Number(contractId)) ? 0 : Number(contractId)};
export const IS_LIVE_WALLET = ${!!walletAddress};
export const WALLET_ADDRESS = '${walletAddress || ''}';
`,
  '/index.tsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import { WalletProvider, NetworkId } from '/mock-wallet';
import App from './App';

// Polyfill BigInt serialization for LLM debug dumps
if (typeof BigInt !== 'undefined') {
  (BigInt.prototype as any).toJSON = function() {
    return this.toString();
  };
}

// Setup basic wallet manager for preview
const walletManager = {
  activeWallet: null,
  activeAccount: null,
  wallets: [],
  network: NetworkId.TESTNET,
  subscribe: () => () => {},
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <WalletProvider manager={walletManager as any}>
    <App />
  </WalletProvider>
);
`,
  '/mock-wallet.tsx': `
import { useState, useEffect } from 'react';
export const WalletProvider = ({ children }) => <>{children}</>;
export const NetworkId = { TESTNET: 'testnet', MAINNET: 'mainnet' };
export const useWallet = () => {
  const [activeAddress, setActiveAddress] = useState('${walletAddress || 'DEMO_ADDRESS_ABC123'}');
  
  useEffect(() => {
    const handleEvent = (event) => {
      if (event.data?.type === 'ALGOCRAFT_EVENT' && event.data.event === 'WALLET_CHANGED') {
        setActiveAddress(event.data.payload.address);
      }
    };
    window.addEventListener('message', handleEvent);
    return () => window.removeEventListener('message', handleEvent);
  }, []);

  return {
    activeAddress,
    signer: async (txns) => {
      // Proxy signing to parent
      return new Promise((resolve, reject) => {
        const id = Math.random().toString(36).substring(7);
        const handleResponse = (e) => {
          if (e.data?.id === id) {
            window.removeEventListener('message', handleResponse);
            if (e.data.error) reject(new Error(e.data.error));
            else resolve(e.data.result);
          }
        };
        window.addEventListener('message', handleResponse);
        window.parent.postMessage({ id, type: 'SIGN_TRANSACTION', payload: { txns } }, '*');
      });
    },
    wallets: [],
  };
};
`,
  '/mock-algosdk.ts': `
export default {
  Algodv2: class { 
    constructor() {}
    getApplicationByID(id) {
       return {
         do: () => new Promise((resolve, reject) => {
            const rid = 'read_' + Math.random().toString(36).substring(7);
            const handle = (e) => {
              if (e.data?.id === rid) {
                window.removeEventListener('message', handle);
                if (e.data.error) reject(new Error(e.data.error));
                else resolve({ params: { 'global-state': Object.entries(e.data.result).map(([k,v]) => ({ 
                  key: btoa(k), 
                  value: typeof v === 'number' ? { type: 2, uint: v } : { type: 1, bytes: v } 
                })) } });
              }
            };
            window.addEventListener('message', handle);
            window.parent.postMessage({ id: rid, type: 'READ_STATE', payload: { appId: id } }, '*');
         })
       };
    }
  },
  makeApplicationCreateTxnFromObject: () => ({}),
};
`,
})

const dependencies = {
  'lucide-react': 'latest',
}

const customTheme = {
  colors: {
    surface1: '#0f172a',
    surface2: '#16213a',
    surface3: '#24324f',
    clickable: '#94a3b8',
    base: '#e2e8f0',
    disabled: '#475569',
    hover: '#2563eb',
    accent: '#2563eb',
    error: '#ef4444',
    errorSurface: '#7f1d1d',
  },
  syntax: {
    plain: '#e5e5e5',
    comment: { color: '#737373', fontStyle: 'italic' as const },
    keyword: '#2563eb',
    tag: '#f472b6',
    punctuation: '#e5e5e5',
    definition: '#22d3ee',
    property: '#60a5fa',
    static: '#22d3ee',
    string: '#4ade80',
  },
  font: {
    body: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: 'var(--font-mono)',
    size: '13px',
    lineHeight: '1.5',
  },
}

const defaultAppCode = [
  'export default function App() {',
  '  return (',
  '    <div style={{',
  '      padding: "2rem",',
  '      fontFamily: "system-ui, sans-serif",',
  '      color: "#10213a",',
  '      background: "linear-gradient(135deg, #f8fbff 0%, #dbeafe 100%)",',
  '      minHeight: "100vh"',
  '    }}>',
  '      <h1>Welcome to AlgoCraft</h1>',
  '      <p>Your DApp will appear here once generated.</p>',
  '    </div>',
  '  );',
  '}',
].join('\n')

function SandpackFileWatcher({ 
  initialFiles, 
  onDirtyChange 
}: { 
  initialFiles: Record<string, string>, 
  onDirtyChange?: (isDirty: boolean, currentFiles: Record<string, string>) => void 
}) {
  const { sandpack } = useSandpack();
  const { files: currentFiles } = sandpack;
  const onDirtyChangeRef = React.useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;
  const prevDirtyRef = React.useRef<boolean | null>(null);

  React.useEffect(() => {
    if (!onDirtyChangeRef.current) return;

    const filesRecord = currentFiles as Record<string, { code: string }>;
    const simpleFiles: Record<string, string> = {};
    let isDirty = false;

    for (const [path, file] of Object.entries(filesRecord)) {
      const originalPath = initialFiles[path] !== undefined ? path : path.replace(/^\//, '');
      const contentInSandpack = file.code;
      const initialContent = initialFiles[originalPath] !== undefined ? initialFiles[originalPath] : initialFiles[path];
      simpleFiles[originalPath !== undefined && initialFiles[originalPath] !== undefined ? originalPath : path] = contentInSandpack;
      if (initialContent !== undefined && initialContent !== contentInSandpack) {
        isDirty = true;
      }
    }

    if (!isDirty && Object.keys(simpleFiles).length !== Object.keys(initialFiles).length) {
      isDirty = true;
    }

    // Only call if dirty state actually changed to avoid infinite loop
    if (prevDirtyRef.current !== isDirty) {
      prevDirtyRef.current = isDirty;
      onDirtyChangeRef.current(isDirty, simpleFiles);
    }
  }, [currentFiles, initialFiles]);

  return null;
}

function SandpackStateSync({ 
  activeFileProp, 
  onActiveFileChange 
}: { 
  activeFileProp?: string, 
  onActiveFileChange?: (path: string) => void 
}) {
  const { sandpack } = useSandpack();
  const latestProp = React.useRef(activeFileProp);
  latestProp.current = activeFileProp;

  // Sync internal sandpack tab changes UP to parent
  React.useEffect(() => {
    if (!onActiveFileChange || !sandpack.activeFile) return;
    const current = sandpack.activeFile;
    const normalizedProp = latestProp.current?.startsWith('/') ? latestProp.current : `/${latestProp.current}`;
    if (current !== latestProp.current && current !== normalizedProp) {
      onActiveFileChange(current);
    }
  }, [sandpack.activeFile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync parent-driven file selection DOWN into sandpack
  React.useEffect(() => {
    if (!activeFileProp) return;
    const target = activeFileProp.startsWith('/') ? activeFileProp : `/${activeFileProp}`;
    if (sandpack.files[target] && sandpack.activeFile !== target) {
      sandpack.setActiveFile(target);
    }
  }, [activeFileProp]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

/** Report Sandpack compile errors to the store for fix-frontend follow-ups. */
function SandpackPreviewErrorReporter() {
  const { sandpack } = useSandpack()
  const setPreviewError = useAlgoCraftStore((s) => s.setPreviewError)
  const lastErrorRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    const raw = sandpack.error
    if (!raw) {
      if (lastErrorRef.current !== null) {
        lastErrorRef.current = null
        setPreviewError(null)
      }
      return
    }
    const message =
      typeof raw === 'string'
        ? raw
        : (raw as { message?: string }).message || String(raw)
    if (message === lastErrorRef.current) return
    lastErrorRef.current = message
    setPreviewError(message)
  }, [sandpack.error, setPreviewError])

  return null
}

function PreviewHeader({ contractId, walletAddress }: { contractId: string | null; walletAddress?: string | null }) {
  const isLive = !!walletAddress
  const displayAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : 'ABCD...WXYZ'

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-neutral-800/50 border-b border-neutral-700/50 text-xs">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          <span className="text-blue-400 font-medium">{isLive ? 'Live Mode' : 'Demo Mode'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-neutral-400">
          <Globe className="w-3 h-3" />
          <span>Algorand Testnet</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${
          isLive
            ? 'bg-blue-500/10 border border-blue-500/20'
            : 'bg-neutral-700/50 border border-neutral-600/30'
        }`}>
          <Wallet className={`w-3 h-3 ${isLive ? 'text-blue-400' : 'text-neutral-400'}`} />
          <span className={`font-mono ${isLive ? 'text-blue-400' : 'text-neutral-400'}`}>{displayAddress}</span>
        </div>

        {contractId && contractId !== 'NOT_DEPLOYED' && (
          <a
            href={loraApplicationUrl(contractId)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
          >
            <span className="text-blue-400 font-mono">App ID: {contractId}</span>
            <ExternalLink className="w-3 h-3 text-blue-400" />
          </a>
        )}
      </div>
    </div>
  )
}

export function SandpackPreview(props: SandpackPreviewProps) {
  const { files, contractId, walletAddress, activeTab = 'preview', excludeBoilerplate = false, onDirtyChange, activeFile, onActiveFileChange } = props
  
  const showCode = activeTab === 'code'
  const showPreview = activeTab === 'preview'

  const allFiles = React.useMemo(() => {
    const rawFiles: Record<string, string> = patchPreviewBridgeFiles({
      ...(excludeBoilerplate ? {} : getDefaultFiles(contractId, walletAddress)),
      ...files,
    })

    if (!excludeBoilerplate && !rawFiles['/App.tsx'] && !rawFiles['/App.jsx'] && !rawFiles['/App.js'] && !rawFiles['App.tsx']) {
      rawFiles['/App.tsx'] = defaultAppCode
    }

    const normalizedFiles: Record<string, string> = {}
    for (const [path, content] of Object.entries(rawFiles)) {
      const normalizedPath = path.startsWith('/') ? path : `/${path}`
      let finalContent = content
      
      if (normalizedPath.endsWith('.ts') || normalizedPath.endsWith('.tsx') || normalizedPath.endsWith('.js') || normalizedPath.endsWith('.jsx')) {
        finalContent = finalContent.replace(/['"]@txnlab\/use-wallet-react['"]/g, "'/mock-wallet'")
        finalContent = finalContent.replace(/['"]@txnlab\/use-wallet['"]/g, "'/mock-wallet'")
        finalContent = finalContent.replace(/['"]algosdk['"]/g, "'/mock-algosdk'")
      }
      normalizedFiles[normalizedPath] = finalContent
    }
    
    return patchGeneratedFrontendFiles(normalizedFiles)
  }, [files, contractId, walletAddress, excludeBoilerplate])

  const sandpackSetup = React.useMemo(() => ({
    dependencies,
  }), [])

  const sandpackOptions = React.useMemo(() => ({
    recompileMode: 'delayed' as const,
    recompileDelay: 500,
    visibleFiles: visibleUserFiles(files),
  }), [files])

  return (
    <SandpackErrorBoundary files={allFiles}>
      <div className="h-full w-full flex flex-col">
        {!showCode && (
          <PreviewHeader contractId={contractId} walletAddress={walletAddress} />
        )}

          <div className="flex-1 min-h-0 flex flex-col relative w-full h-full">
            <SandpackProvider
              template="react-ts"
              theme={customTheme}
              files={allFiles}
              customSetup={sandpackSetup}
              options={sandpackOptions}
            >
              <SandpackFileWatcher initialFiles={allFiles} onDirtyChange={onDirtyChange} />
              <SandpackPreviewErrorReporter />
              <SandpackStateSync activeFileProp={activeFile} onActiveFileChange={onActiveFileChange} />
              <div className="absolute inset-0 flex flex-col [&_.sp-layout]:flex-1 [&_.sp-layout]:h-full [&_.sp-layout]:min-h-0 [&_.sp-layout]:!rounded-none [&_.sp-layout]:!border-0 [&_.sp-wrapper]:h-full [&_.sp-wrapper]:min-h-0 [&_.sp-preview-container]:h-full [&_.sp-preview-container]:min-h-0">
                <SandpackLayout style={{ height: '100%' }}>
                  {showCode && (
                    <SandpackCodeEditor
                      showTabs
                      showLineNumbers
                      showInlineErrors
                      wrapContent
                      style={{ height: '100%', overflow: 'auto' }}
                    />
                  )}
                  {showPreview && (
                    <SandpackPreviewComponent
                      showOpenInCodeSandbox={false}
                      showRefreshButton
                      style={{ height: '100%' }}
                    />
                  )}
                </SandpackLayout>
              </div>
            </SandpackProvider>
          </div>
          <BridgeHandler />
        </div>
      </SandpackErrorBoundary>
    )
  }
