'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAlgoCraftStore } from '@/lib/store'
import dynamic from 'next/dynamic'
import { BuildStatusExpanded } from './BuildStatus'
import { ExportButton } from './ExportButton'
import { ContractCodeView } from './ContractCodeView'
import { cn } from '@/lib/utils'
import { loraApplicationUrl } from '@/lib/sandpack-files'
import {
  Code,
  Eye,
  Loader2,
  RotateCw,
  ExternalLink,
  Save,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const SandpackPreview = dynamic(
  () => import('./SandpackPreview').then((m) => m.SandpackPreview),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center bg-background/80">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  },
)

type Tab = 'preview' | 'code' | 'status'

export function PreviewPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('preview')
  const [refreshKey, setRefreshKey] = useState(0)
  const [isDirty, setIsDirty] = useState(false)
  const [dirtyFiles, setDirtyFiles] = useState<Record<string, string>>({})
  const [activeFile, setActiveFile] = useState<string | undefined>()

  const { generatedFiles, buildStatus, contractId, walletAddress, setGeneratedFiles, previewRevision } =
    useAlgoCraftStore()
  const hasFrontend = Object.keys(generatedFiles).some(
    (k) => k.includes('App.tsx') || k.includes('App.jsx'),
  )

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1)
    setIsDirty(false)
  }

  const handleSave = () => {
    setGeneratedFiles(dirtyFiles)
    setIsDirty(false)
  }

  const handleDirtyChange = useCallback((dirty: boolean, files: Record<string, string>) => {
    setIsDirty(dirty)
    setDirtyFiles(files)
  }, [])

  const hasFiles = Object.keys(generatedFiles).length > 0
  const isFixingFrontend = buildStatus === 'fixing_frontend'
  const isBuilding =
    buildStatus !== 'idle' &&
    buildStatus !== 'complete' &&
    buildStatus !== 'error' &&
    !isFixingFrontend

  useEffect(() => {
    if (buildStatus === 'complete' && hasFrontend) {
      setActiveTab('preview')
    }
  }, [buildStatus, hasFrontend])

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden relative border-l border-border/80">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-white/5 bg-surface/50 backdrop-blur-xl px-4 relative z-10 shadow-2xl">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-background/50 border border-white/5">
          {hasFrontend && (
            <ToolbarButton
              active={activeTab === 'preview'}
              onClick={() => setActiveTab('preview')}
              icon={<Eye className="h-4 w-4" />}
              label="Live Preview"
            />
          )}
          <ToolbarButton
            active={activeTab === 'code'}
            onClick={() => setActiveTab('code')}
            icon={<Code className="h-4 w-4" />}
            label="Source Code"
          />

          <div className="flex items-center gap-1 ml-1 border-l border-white/5 pl-2">
            <button
              onClick={handleRefresh}
              className="flex h-8 w-8 items-center justify-center rounded-xl transition-all border bg-background/20 border-white/5 text-muted hover:text-foreground shadow-sm"
              title="Refresh preview"
            >
              <RotateCw className="h-4 w-4" />
            </button>

            {isDirty && (
              <motion.button
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={handleSave}
                className="flex h-8 items-center gap-2 px-3 rounded-xl transition-all border bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                title="Save edits"
              >
                <Save className="h-4 w-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Save</span>
              </motion.button>
            )}
          </div>

          {isBuilding && (
            <ToolbarButton
              active={activeTab === 'status'}
              onClick={() => setActiveTab('status')}
              icon={<Loader2 className="h-4 w-4 animate-spin" />}
              label="Pipeline"
              highlight
            />
          )}
        </div>

        {contractId && (
          <a
            href={loraApplicationUrl(contractId)}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-nb-gold/10 border border-nb-gold/25 text-[11px] font-bold font-mono text-nb-gold hover:bg-nb-gold/20 transition-colors"
          >
            App ID: {contractId}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}

        <ExportButton />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden relative z-0 min-h-0">
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {hasFrontend ? (
              <motion.div
                key="sandpack-preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0"
              >
                <SandpackPreview
                  key={`${refreshKey}-${previewRevision}`}
                  files={generatedFiles}
                  contractId={contractId}
                  walletAddress={walletAddress}
                  activeTab={activeTab === 'status' ? 'preview' : activeTab}
                  onDirtyChange={handleDirtyChange}
                  activeFile={activeFile}
                  onActiveFileChange={setActiveFile}
                />
                {isFixingFrontend && (
                  <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface/90 px-5 py-3 shadow-lg">
                      <Loader2 className="h-5 w-5 animate-spin text-nb-gold" />
                      <span className="text-sm font-medium text-foreground">Updating preview…</span>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : hasFiles ? (
              <motion.div
                key="contract-only"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 p-6 overflow-auto"
              >
                <ContractCodeView className="max-w-4xl mx-auto" />
              </motion.div>
            ) : (
              <motion.div className="absolute inset-0 flex items-center justify-center text-muted text-sm">
                No preview files yet.
              </motion.div>
            )}

            {activeTab === 'status' && (
              <motion.div
                key="status"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 overflow-y-auto bg-background/95 backdrop-blur-md z-20"
              >
                <BuildStatusExpanded />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function ToolbarButton({
  active,
  onClick,
  icon,
  label,
  highlight,
  disabled,
}: {
  active?: boolean
  onClick?: () => void
  icon: React.ReactNode
  label: string
  highlight?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group flex h-8 items-center gap-2 px-3 rounded-xl text-[11px] font-bold uppercase tracking-tight transition-all btn-press shadow-sm',
        active
          ? 'bg-nb-gold text-background shadow-lg shadow-nb-gold/20'
          : 'text-muted hover:text-foreground hover:bg-surface-2',
        highlight && !active && 'text-nb-gold animate-pulse-glow',
        disabled && 'opacity-30 cursor-default',
      )}
    >
      <span className={cn('transition-transform group-hover:scale-110', active ? 'text-background' : '')}>
        {icon}
      </span>
      <span className="hidden lg:inline">{label}</span>
    </button>
  )
}
