'use client'

import { useState, useEffect } from 'react'
import { useAlgoCraftStore } from '@/lib/store'
import { SandpackPreview } from './SandpackPreview'
import { FileTree } from './FileTree'
import { BuildStatusExpanded } from './BuildStatus'
import { BuildAnimation } from './BuildAnimation'
import { ExportButton } from './ExportButton'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import {
  Code,
  Eye,
  Terminal,
  FolderTree,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Monitor,
  Tablet,
  Smartphone,
  ExternalLink,
  MoreHorizontal,
  Layout,
  Layers,
  Globe,
  Save,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

type Tab = 'preview' | 'code' | 'console' | 'status'

export function PreviewPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('preview')
  const [showFileTree, setShowFileTree] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isDirty, setIsDirty] = useState(false)
  const [dirtyFiles, setDirtyFiles] = useState<Record<string, string>>({})
  const [activeFile, setActiveFile] = useState<string | undefined>()
  
  const { generatedFiles, buildStatus, contractId, walletAddress, setGeneratedFiles } = useAlgoCraftStore()

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
    setIsDirty(false)
  }

  const handleSave = () => {
    setGeneratedFiles(dirtyFiles)
    setIsDirty(false)
  }

  const handleDirtyChange = (dirty: boolean, files: Record<string, string>) => {
    setIsDirty(dirty)
    setDirtyFiles(files)
  }

  const hasFiles = Object.keys(generatedFiles).length > 0
  const isBuilding = buildStatus !== 'idle' && buildStatus !== 'complete' && buildStatus !== 'error'

  useEffect(() => {
    if (buildStatus === 'awaiting_signature') {
      setActiveTab('status')
    }
  }, [buildStatus])

  const displayUrl = contractId
    ? `algorand://testnet/${contractId}`
    : 'localhost:3000'

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden relative border-l border-border/80">
      {/* Browser-like Toolbar */}
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-white/5 bg-surface/50 backdrop-blur-xl px-4 relative z-10 shadow-2xl">
        
        {/* Left: View Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-background/50 border border-white/5">
          <ToolbarButton
            active={activeTab === 'preview'}
            onClick={() => setActiveTab('preview')}
            icon={<Eye className="h-4 w-4" />}
            label="Live Preview"
          />
          <ToolbarButton
            active={activeTab === 'code'}
            onClick={() => setActiveTab('code')}
            icon={<Code className="h-4 w-4" />}
            label="Source Code"
          />
          <ToolbarButton
            active={activeTab === 'console'}
            onClick={() => setActiveTab('console')}
            icon={<Terminal className="h-4 w-4" />}
            label="Console"
          />
          
          <div className="flex items-center gap-1 ml-1 border-l border-white/5 pl-2">
            <button
              onClick={handleRefresh}
              className="flex h-8 w-8 items-center justify-center rounded-xl transition-all border bg-background/20 border-white/5 text-muted hover:text-foreground shadow-sm"
              title="Refresh Sandpack"
            >
              <RotateCw className="h-4 w-4" />
            </button>

            {isDirty && (
              <motion.button
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={handleSave}
                className="flex h-8 items-center gap-2 px-3 rounded-xl transition-all border bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 shadow-lg shadow-emerald-500/10"
                title="Save Edits"
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

        {/* Center: Address Bar */}
        <div className="flex-1 max-w-xl mx-4">
          <div className="flex h-8 items-center rounded-xl border border-white/5 bg-background shadow-inner px-4 gap-3">
             <div className="flex items-center gap-1 opacity-40">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
             </div>
             <Globe className="h-3.5 w-3.5 text-muted opacity-60" />
             <span className="truncate text-[11px] font-bold text-muted/80 tracking-tight font-mono">
                {displayUrl}
             </span>
             <motion.div 
               animate={{ rotate: 360 }}
               transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
               className="ml-auto"
             >
                <RotateCw className="h-3 w-3 text-muted/30" />
             </motion.div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-background/50 border border-white/5 mr-2">
            <ResponsiveToggle icon={<Monitor className="h-3.5 w-3.5" />} title="Desktop" active />
            <ResponsiveToggle icon={<Tablet className="h-3.5 w-3.5" />} title="Tablet" />
            <ResponsiveToggle icon={<Smartphone className="h-3.5 w-3.5" />} title="Mobile" />
          </div>

          <ExportButton />
          
          <button
            onClick={() => setShowFileTree(!showFileTree)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-xl transition-all border",
              showFileTree 
                ? "bg-nb-gold/10 border-nb-gold/30 text-nb-gold" 
                : "bg-background/20 border-white/5 text-muted hover:text-foreground"
            )}
            title="Toggle File Tree"
          >
            <FolderTree className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex flex-1 overflow-hidden relative z-0">
        <AnimatePresence mode="wait">
          {showFileTree && hasFiles && (
            <motion.div 
              initial={{ x: -200, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -200, opacity: 0 }}
              className="w-64 border-r border-white/5 bg-surface/30 backdrop-blur-sm z-10 shadow-xl"
            >
              <FileTree 
                files={generatedFiles} 
                onSelect={(path) => {
                  setActiveFile(path)
                  setActiveTab('code')
                }}
                activePath={activeFile}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {isBuilding && !hasFiles ? (
              <motion.div key="build-animation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
                <BuildAnimation />
              </motion.div>
            ) : hasFiles ? (
              <motion.div key="sandpack-preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
                <SandpackPreview
                  key={refreshKey}
                  files={generatedFiles}
                  contractId={contractId}
                  walletAddress={walletAddress}
                  activeTab={activeTab === 'status' ? 'preview' : activeTab}
                  onDirtyChange={handleDirtyChange}
                  activeFile={activeFile}
                  onActiveFileChange={setActiveFile}
                />
              </motion.div>
            ) : (
              <motion.div key="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
                <EmptyState />
              </motion.div>
            )}
            
            {activeTab === 'status' && (
              <motion.div key="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 overflow-y-auto bg-background/95 backdrop-blur-md z-20">
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
        disabled && 'opacity-30 cursor-default'
      )}
    >
      <span className={cn("transition-transform group-hover:scale-110", active ? "text-background" : "")}>{icon}</span>
      <span className="hidden lg:inline">{label}</span>
      {active && (
         <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5" />
      )}
    </button>
  )
}

function ResponsiveToggle({ icon, title, active }: { icon: React.ReactNode, title: string, active?: boolean }) {
  return (
    <button
      title={title}
      className={cn(
        "p-1.5 rounded-lg transition-all",
        active ? "text-nb-gold bg-nb-gold/10" : "text-muted hover:text-foreground hover:bg-surface-2"
      )}
    >
      {icon}
    </button>
  )
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center bg-background/50 backdrop-blur-sm relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-nb-gold/5 rounded-full blur-[100px] pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 flex flex-col items-center"
      >
        <div className="rounded-3xl border border-nb-gold/20 p-8 mb-8 bg-nb-gold/5 shadow-2xl shadow-nb-gold/10 animate-float">
          <Image src="/logo.png" alt="AlgoCraft" width={56} height={56} className="opacity-95" />
        </div>
        
        <h3 className="mb-4 text-3xl font-black gradient-text tracking-tight">System Initialization</h3>
        <p className="text-sm text-muted max-w-sm mb-10 leading-relaxed px-10">
          AlgoCraft is standing by. Your code, previews, and deployment data will materialize here once the architect process begins.
        </p>

        <div className="flex items-center gap-4 px-6 py-2 rounded-2xl bg-surface border border-white/5 text-[10px] font-bold uppercase tracking-widest text-muted/60">
           <Layers className="w-4 h-4 text-nb-gold/60" />
           <span>Awaiting Prompt Input</span>
           <div className="w-1 h-1 rounded-full bg-nb-gold/40 animate-ping" />
        </div>
      </motion.div>
    </div>
  )
}
