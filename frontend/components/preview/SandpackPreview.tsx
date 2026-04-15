'use client'

import React, { Component, type ReactNode, useState, useMemo } from 'react'
import {
  SandpackProvider,
  SandpackPreview as SandpackPreviewComponent,
  SandpackCodeEditor,
  SandpackConsole,
  SandpackLayout,
  useSandpack,
} from '@codesandbox/sandpack-react'
import { Wallet, ExternalLink, Globe, Copy, Check } from 'lucide-react'
import { BridgeHandler } from './BridgeHandler'

interface SandpackPreviewProps {
  files: Record<string, string>
  contractId: string | null
  walletAddress?: string | null
  activeTab?: 'preview' | 'code' | 'console'
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
              Syntax Error in Generated Code
            </h3>
            <p className="text-sm text-red-300/80 mb-4">
              The generated code has a syntax error. This can happen occasionally with AI-generated code.
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

  React.useEffect(() => {
    if (!onDirtyChange) return;

    // Convert internal sandpack files to simple record
    const simpleFiles: Record<string, string> = {};
    let isDirty = false;

    // Type casting because Sandpack types are sometimes tricky in local environments
    const filesRecord = currentFiles as Record<string, { code: string }>;

    for (const [path, file] of Object.entries(filesRecord)) {
      // Remove leading slash if it exists in Sandpack but not in initialFiles
      const originalPath = initialFiles[path] !== undefined ? path : path.replace(/^\//, '');
      const contentInSandpack = file.code;
      const initialContent = initialFiles[originalPath] !== undefined ? initialFiles[originalPath] : initialFiles[path];
      
      // Use the original path so we don't accidentally rename keys when saving
      if (initialFiles[originalPath] !== undefined) {
         simpleFiles[originalPath] = contentInSandpack;
      } else {
         simpleFiles[path] = contentInSandpack;
      }
      
      // Check if this file exists and is different from initial
      if (initialContent !== undefined && initialContent !== contentInSandpack) {
        isDirty = true;
      }
    }

    // Also check for new files
    if (!isDirty && Object.keys(simpleFiles).length !== Object.keys(initialFiles).length) {
      isDirty = true;
    }

    onDirtyChange(isDirty, simpleFiles);
  }, [currentFiles, initialFiles, onDirtyChange]);

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
  const isInternalChange = React.useRef(false);
  
  // Keep track of the latest prop as a ref to avoid stale closure issues
  // while comparing with internal state
  latestProp.current = activeFileProp;
  
  React.useEffect(() => {
    // If sandpack switches internally, sync it UP to parent
    // Sandpack sometimes normalizes files to have a leading slash
    if (onActiveFileChange && sandpack.activeFile) {
      const current = sandpack.activeFile;
      const normalizedProp = latestProp.current?.startsWith('/') ? latestProp.current : `/${latestProp.current}`;
      
      if (current !== latestProp.current && current !== normalizedProp) {
        // Only trigger update if it's truly a different file and not just a slash mismatch
        onActiveFileChange(current);
      }
    }
  }, [sandpack.activeFile, onActiveFileChange]);

  React.useEffect(() => {
    if (activeFileProp) {
      const target = activeFileProp.startsWith('/') ? activeFileProp : `/${activeFileProp}`;
      
      if (sandpack.files[target] && sandpack.activeFile !== target) {
        sandpack.setActiveFile(target);
      }
    }
  }, [activeFileProp, sandpack]);

  return null;
}

function PreviewHeader({ contractId, walletAddress }: { contractId: string | null; walletAddress?: string | null }) {
  const [copied, setCopied] = useState(false)
  const isLive = !!walletAddress
  const displayAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : 'ABCD...WXYZ'

  const copyContractId = () => {
    if (contractId) {
      navigator.clipboard.writeText(contractId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

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
          <button
            onClick={copyContractId}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
          >
             <span className="text-blue-400 font-mono">
              App ID: {contractId}
            </span>
            {copied ? (
              <Check className="w-3 h-3 text-green-400" />
            ) : (
              <Copy className="w-3 h-3 text-blue-400" />
            )}
          </button>
        )}
      </div>
    </div>
  )
}

export function SandpackPreview(props: SandpackPreviewProps) {
  const { files, contractId, walletAddress, activeTab = 'preview', excludeBoilerplate = false, onDirtyChange, activeFile, onActiveFileChange } = props
  
  const showCode = activeTab === 'code'
  const showConsole = activeTab === 'console'
  const showPreview = activeTab === 'preview'

  const allFiles = React.useMemo(() => {
    const rawFiles: Record<string, string> = {
      ...(excludeBoilerplate ? {} : getDefaultFiles(contractId, walletAddress)),
      ...files,
    }

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
    
    return normalizedFiles
  }, [files, contractId, walletAddress, excludeBoilerplate])

  const sandpackSetup = React.useMemo(() => ({
    dependencies,
  }), [])

  const sandpackOptions = React.useMemo(() => ({
    activeFile: activeFile ? (activeFile.startsWith('/') ? activeFile : `/${activeFile}`) : undefined,
    recompileMode: 'delayed' as const,
    recompileDelay: 500,
    visibleFiles: (excludeBoilerplate 
      ? Object.keys(files).map(f => f.startsWith('/') ? f : `/${f}`)
      : Object.keys(allFiles).filter(f => !f.includes('mock-') && !f.includes('index.tsx') && !f.includes('.css'))
    ),
  }), [allFiles, excludeBoilerplate, files, activeFile])

  return (
    <SandpackErrorBoundary files={allFiles}>
      <div className="h-full w-full flex flex-col">
        {!showCode && !showConsole && (
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
                  {showConsole && (
                    <SandpackConsole
                      showHeader
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
