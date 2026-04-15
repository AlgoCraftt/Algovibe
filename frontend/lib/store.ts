import { create } from 'zustand'
import { generateDApp, finalizeDeployment, type BuildEvent, type Protocol, type SuggestedProtocol, fetchProtocols, fetchSuggestedProtocols } from './api'

export type BuildStep =
  | 'idle'
  | 'analyzing'
  | 'retrieving_docs'
  | 'generating_contract'
  | 'compiling'
  | 'deploying'
  | 'awaiting_signature'
  | 'generating_react'
  | 'complete'
  | 'error'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
}

interface AlgoCraftStore {
  // State
  messages: Message[]
  buildStatus: BuildStep
  buildLogs: string[]
  generatedFiles: Record<string, string>
  contractId: string | null
  isBuilding: boolean
  error: string | null
  arc32Spec: any | null
  deploymentCode: string | null

  // Wallet state
  walletAddress: string | null

  // Pending wallet signature (set when backend emits sign_required)
  pendingSignature: { unsigned_tx: string; buildId: string; framework?: string; approval_teal?: string; clear_teal?: string; arc32_spec?: any } | null

  // Theme
  theme: 'light' | 'dark'

  // Sidebar / Protocols state
  sidebarTab: 'chat' | 'protocols'
  protocols: Protocol[]
  suggestedProtocols: SuggestedProtocol[]
  selectedProtocols: string[]   // queued IDs (pending, not yet sent)
  integratedProtocols: string[] // IDs already sent to the pipeline
  protocolsLoading: boolean
  suggestionsLoading: boolean
  templateType: string | null
  contractSpec: Record<string, unknown> | null
  
  // Vercel deployment (UI mock/placeholder as requested)
  isDeployingToVercel: boolean
  vercelUrl: string | null

  // Actions
  toggleTheme: () => void
  sendPrompt: (prompt: string) => Promise<void>
  reset: () => void
  addMessage: (role: Message['role'], content: string) => void
  setBuildStatus: (status: BuildStep) => void
  addBuildLog: (log: string) => void
  setGeneratedFiles: (files: Record<string, string>) => void
  setContractId: (id: string) => void
  setError: (error: string | null) => void
  loadTestFiles: () => void
  setWalletAddress: (address: string | null) => void
  setPendingSignature: (data: { unsigned_tx: string; buildId: string; framework?: string; approval_teal?: string; clear_teal?: string; arc32_spec?: any } | null) => void
  completeDeployment: (buildId: string, packageId: string) => Promise<void>
  deployToVercel: () => Promise<void>
  setArc32Spec: (spec: any | null) => void
  setDeploymentCode: (code: string | null) => void

  // Protocol actions
  setSidebarTab: (tab: 'chat' | 'protocols') => void
  loadProtocols: () => Promise<void>
  loadSuggestedProtocols: () => Promise<void>
  toggleProtocol: (protocol: Protocol | SuggestedProtocol) => void
  removeSelectedProtocol: (id: string) => void
  getSelectedProtocolDetails: () => { id: string; name: string; icon: string }[]
}

export const useAlgoCraftStore = create<AlgoCraftStore>((set, get) => ({
  // Initial state
  messages: [],
  buildStatus: 'idle',
  buildLogs: [],
  generatedFiles: {},
  contractId: null,
  isBuilding: false,
  error: null,
  arc32Spec: null,
  deploymentCode: null,

  // Wallet state
  walletAddress: null,
  pendingSignature: null,

  // Theme
  theme: 'light',

  // Sidebar / Protocols
  sidebarTab: 'chat',
  protocols: [],
  suggestedProtocols: [],
  selectedProtocols: [],
  integratedProtocols: [],
  protocolsLoading: false,
  suggestionsLoading: false,
  templateType: null,
  contractSpec: null,
  isDeployingToVercel: false,
  vercelUrl: null,

  // Actions
  toggleTheme: () => {
    set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' }))
  },
  addMessage: (role, content) => {
    const message: Message = {
      id: crypto.randomUUID(),
      role,
      content,
      timestamp: new Date(),
    }
    set((state) => ({
      messages: [...state.messages, message],
    }))
  },

  setBuildStatus: (status) => {
    set({ buildStatus: status })
  },

  addBuildLog: (log) => {
    set((state) => ({
      buildLogs: [...state.buildLogs, log],
    }))
  },

  setGeneratedFiles: (files) => {
    set((state) => ({ 
      generatedFiles: { 
        ...state.generatedFiles, 
        ...files 
      } 
    }))
  },

  setContractId: (id) => {
    set({ contractId: id })
  },

  setError: (error) => {
    set({ error, buildStatus: error ? 'error' : get().buildStatus })
  },
  
  setArc32Spec: (spec) => {
    set({ arc32Spec: spec })
  },

  setDeploymentCode: (code) => {
    set({ deploymentCode: code })
  },

  sendPrompt: async (prompt) => {
    const { addMessage, setBuildStatus, addBuildLog, setGeneratedFiles, setContractId, setError, protocols, selectedProtocols } = get()

    // Build the enriched prompt with any selected protocols
    let enrichedPrompt = prompt
    const protocolNames: string[] = []
    if (selectedProtocols.length > 0) {
      const protocolContextParts: string[] = []
      for (const pid of selectedProtocols) {
        const p = protocols.find(pr => pr.id === pid)
        if (p) {
          protocolNames.push(p.name)
          protocolContextParts.push(
            `## ${p.name}\n${p.description}\n\n${p.integration_prompt}`
          )
        }
      }
      if (protocolContextParts.length > 0) {
        enrichedPrompt = `${prompt}\n\n--- Integrate the following Algorand ecosystem protocols into this DApp ---\n\n${protocolContextParts.join('\n\n---\n\n')}`
      }
    }

    // Move selected → integrated and clear selection
    set((state) => ({
      isBuilding: true,
      buildStatus: 'analyzing' as BuildStep,
      buildLogs: [],
      error: null,
      integratedProtocols: Array.from(new Set([...state.integratedProtocols, ...state.selectedProtocols])),
      selectedProtocols: [],
    }))

    // Add user message (show clean prompt + protocol tags)
    const displayMsg = protocolNames.length > 0
      ? `${prompt}\n\n[Protocols: ${protocolNames.join(', ')}]`
      : prompt
    addMessage('user', displayMsg)

    try {
      // Stream build events
      for await (const event of generateDApp({ prompt: enrichedPrompt, user_wallet: get().walletAddress || undefined })) {
        // Capture sign_required payload before passing to handleBuildEvent
        if (event.step === 'sign_required' && event.build_id) {
          set({ 
            pendingSignature: { 
              unsigned_tx: event.unsigned_tx || 'client', 
              buildId: event.build_id, 
              framework: event.framework, 
              approval_teal: event.approval_teal, 
              clear_teal: event.clear_teal, 
              arc32_spec: event.arc32_spec 
            },
            arc32Spec: event.arc32_spec || get().arc32Spec 
          })
        }

        handleBuildEvent(event, {
          setBuildStatus,
          addBuildLog,
          setGeneratedFiles,
          setContractId,
          setError,
          addMessage,
        }, {
          setTemplateType: (t: string) => set({ templateType: t }),
          setContractSpec: (s: Record<string, unknown>) => set({ contractSpec: s }),
          setArc32Spec: (s: any) => set({ arc32Spec: s }),
          setDeploymentCode: (c: string) => set({ deploymentCode: c }),
        })
      }

      // Build complete (or paused at awaiting_signature — isBuilding stays true
      // until completeDeployment is called)
      if (get().buildStatus !== 'awaiting_signature') {
        set({ isBuilding: false })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(errorMessage)
      addMessage('system', `Error: ${errorMessage}`)
      set({ isBuilding: false })
    }
  },

  reset: () => {
    set({
      messages: [],
      buildStatus: 'idle',
      buildLogs: [],
      generatedFiles: {},
      contractId: null,
      isBuilding: false,
      error: null,
      pendingSignature: null,
      arc32Spec: null,
      deploymentCode: null,
      isDeployingToVercel: false,
      vercelUrl: null,
      // Wallet state intentionally preserved across reset
    })
  },

  setWalletAddress: (address) => {
    set({ walletAddress: address })
  },

  setPendingSignature: (data) => {
    set({ pendingSignature: data })
  },

  completeDeployment: async (buildId, packageId) => {
    const { setBuildStatus, addBuildLog, setGeneratedFiles, setContractId, setError, addMessage } = get()
    set({ pendingSignature: null, isBuilding: true })

    try {
      for await (const event of finalizeDeployment(buildId, packageId)) {
        handleBuildEvent(event, {
          setBuildStatus,
          addBuildLog,
          setGeneratedFiles,
          setContractId,
          setError,
          addMessage,
        }, {
          setArc32Spec: (s: any) => set({ arc32Spec: s }),
          setDeploymentCode: (c: string) => set({ deploymentCode: c }),
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(errorMessage)
      addMessage('system', `Error: ${errorMessage}`)
    }

    set({ isBuilding: false })
  },
  
  deployToVercel: async () => {
    set({ isDeployingToVercel: true })
    // Simulate deployment delay
    await new Promise(r => setTimeout(r, 4000))
    set({ 
      isDeployingToVercel: false, 
      vercelUrl: `https://algocraft-dapp-${Math.floor(Math.random()*10000)}.vercel.app` 
    })
  },

  // Protocol actions
  setSidebarTab: (tab) => {
    set({ sidebarTab: tab })
  },

  loadProtocols: async () => {
    if (get().protocols.length > 0) return // already loaded
    set({ protocolsLoading: true })
    try {
      const protocols = await fetchProtocols()
      set({ protocols, protocolsLoading: false })
    } catch {
      set({ protocolsLoading: false })
    }
  },

  loadSuggestedProtocols: async () => {
    const { templateType, contractSpec, integratedProtocols } = get()
    if (!templateType || !contractSpec) return
    set({ suggestionsLoading: true })
    try {
      const suggestions = await fetchSuggestedProtocols(
        templateType,
        contractSpec,
        integratedProtocols,
      )
      set({ suggestedProtocols: suggestions, suggestionsLoading: false })
    } catch {
      set({ suggestionsLoading: false })
    }
  },

  toggleProtocol: (protocol) => {
    const { selectedProtocols, integratedProtocols } = get()
    if (integratedProtocols.includes(protocol.id)) return // already sent

    if (selectedProtocols.includes(protocol.id)) {
      // Deselect
      set({ selectedProtocols: selectedProtocols.filter(id => id !== protocol.id) })
    } else {
      // Select
      set({ selectedProtocols: [...selectedProtocols, protocol.id] })
    }
  },

  removeSelectedProtocol: (id) => {
    set((state) => ({
      selectedProtocols: state.selectedProtocols.filter(pid => pid !== id),
    }))
  },

  getSelectedProtocolDetails: () => {
    const { protocols, selectedProtocols } = get()
    return selectedProtocols
      .map(id => {
        const p = protocols.find(pr => pr.id === id)
        return p ? { id: p.id, name: p.name, icon: p.icon } : null
      })
      .filter((p): p is { id: string; name: string; icon: string } => p !== null)
  },

  loadTestFiles: () => {
    set({
      generatedFiles: {
        '/App.js': `import { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#fff',
      padding: '2rem',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <h1 style={{ marginBottom: '1rem' }}>AlgoCraft Preview Test</h1>
      <p style={{ marginBottom: '1rem' }}>If you see this, Sandpack is working!</p>
      <button
        onClick={() => setCount(c => c + 1)}
        style={{
          background: '#3b82f6',
          color: 'white',
          border: 'none',
          padding: '0.75rem 1.5rem',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '1rem'
        }}
      >
        Count: {count}
      </button>
    </div>
  );
}`,
      },
      contractId: 'TEST_CONTRACT_ID',
      buildStatus: 'complete',
    })
  },
}))

// Helper to handle build events
function handleBuildEvent(
  event: BuildEvent,
  actions: {
    setBuildStatus: (status: BuildStep) => void
    addBuildLog: (log: string) => void
    setGeneratedFiles: (files: Record<string, string>) => void
    setContractId: (id: string) => void
    setError: (error: string | null) => void
    addMessage: (role: Message['role'], content: string) => void
  },
  extras?: {
    setTemplateType?: (t: string) => void
    setContractSpec?: (s: Record<string, unknown>) => void
    setArc32Spec?: (s: any) => void
    setDeploymentCode?: (c: string) => void
  }
) {
  const { setBuildStatus, addBuildLog, setGeneratedFiles, setContractId, setError, addMessage } = actions
  const { setArc32Spec, setDeploymentCode } = extras || {}

  switch (event.step) {
    case 'analyzing':
      setBuildStatus('analyzing')
      if (event.message) addBuildLog(event.message)
      // Capture template_type and spec from analysis events for protocol suggestions
      if (event.template_type) {
        extras?.setTemplateType?.(event.template_type)
      }
      if (event.spec) {
        extras?.setContractSpec?.(event.spec)
      }
      break

    case 'retrieving_docs':
      setBuildStatus('retrieving_docs')
      if (event.message) addBuildLog(event.message)
      break

    case 'generating_contract':
      setBuildStatus('generating_contract')
      if (event.message) addBuildLog(event.message)
      break

    case 'compiling':
      setBuildStatus('compiling')
      if (event.log) addBuildLog(event.log)
      if (event.message) addBuildLog(event.message)
      break

    case 'retrying':
      setBuildStatus('compiling')
      if (event.message) {
        addBuildLog(`⚠️ ${event.message}`)
        addMessage('system', `🔄 ${event.message}`)
      }
      break

    case 'deploying':
      setBuildStatus('deploying')
      if (event.message) addBuildLog(event.message)
      break

    case 'sign_required':
      setBuildStatus('awaiting_signature')
      if (event.message) addBuildLog(event.message)
      // Populate generatedFiles with the contract source code so the Code tab can show it
      if (event.contract_code) {
        const ext = event.framework === 'puyapy' ? '.py' : '.algo.ts'
        const filename = (event.contract_filename || 'contract') + ext
        setGeneratedFiles({
          [filename]: event.contract_code
        })
      }
      break;

    case 'deployed':
      if (event.contract_id) {
        setContractId(event.contract_id)
        addBuildLog(`Contract deployed: ${event.contract_id}`)
      }
      break

    case 'generating_react':
      setBuildStatus('generating_react')
      if (event.message) addBuildLog(event.message)
      break

    case 'complete':
      setBuildStatus('complete')
      if (event.files) {
        setGeneratedFiles(event.files)
      }
      addMessage('assistant', 'Your DApp is ready! Check the preview panel.')
      break

    case 'error':
      setError(event.error || event.message || 'Unknown error')
      addMessage('system', `Error: ${event.error || event.message}`)
      break

    case 'deployment_code_ready':
      if (event.deployment_code) {
        setDeploymentCode?.(event.deployment_code)
        addBuildLog('Deployment client logic generated')
      }
      break

    default:
      if (event.message) addBuildLog(event.message)
  }
}
