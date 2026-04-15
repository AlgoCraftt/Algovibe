'use client'

import { useAlgoCraftStore, type BuildStep } from '@/lib/store'
import { DeploySignPrompt } from './DeploySignPrompt'
import { cn } from '@/lib/utils'
import {
  Brain,
  BookOpen,
  Code,
  Hammer,
  Rocket,
  PenLine,
  Layout,
  Check,
  AlertCircle,
  Loader2,
  Cpu,
  Terminal,
  Activity
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const STEPS: { id: BuildStep; label: string; icon: any; color: string; description: string }[] = [
  { id: 'analyzing', label: 'Analyzing', icon: Brain, color: '#8b5cf6', description: 'Parsing user intent and requirements' },
  { id: 'retrieving_docs', label: 'Researching', icon: BookOpen, color: '#3b82f6', description: 'Consulting Algorand Puya specifications' },
  { id: 'generating_contract', label: 'Architecting', icon: Code, color: '#14b8a6', description: 'Generating secure smart contract logic' },
  { id: 'compiling', label: 'Compiling', icon: Hammer, color: '#f59e0b', description: 'Building optimized AVM bytecode' },
  { id: 'deploying', label: 'Deploying', icon: Rocket, color: '#fbbf24', description: 'Broadcasting to Algorand Testnet' },
  { id: 'awaiting_signature', label: 'Sign Tx', icon: PenLine, color: '#f59e0b', description: 'Awaiting signature from connected wallet' },
  { id: 'generating_react', label: 'Finalizing UI', icon: Layout, color: '#22c55e', description: 'Compiling React frontend resources' },
]

export function BuildStatusExpanded() {
  const { buildStatus, buildLogs, contractId, error } = useAlgoCraftStore()
  const currentIndex = STEPS.findIndex((s) => s.id === buildStatus)

  return (
    <div className="flex h-full flex-col bg-background relative overflow-hidden">
      {/* Background visual detail */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-nb-gold/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-nb-navy/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <div className="border-b border-white/5 px-6 py-5 bg-surface-2/30 backdrop-blur-md flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-nb-gold/10 flex items-center justify-center border border-nb-gold/20 shadow-lg shadow-nb-gold/5">
            <Activity className="w-5 h-5 text-nb-gold animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-black tracking-widest uppercase text-foreground">Pipeline Monitor</h3>
            <p className="text-[10px] font-bold text-muted uppercase tracking-tight">Active Deployment Environment</p>
          </div>
        </div>

        {contractId && (
          <div className="px-4 py-2 rounded-xl bg-nb-gold/10 border border-nb-gold/20 flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-bold uppercase tracking-widest text-nb-gold/60">Application ID</span>
              <span className="text-xs font-mono font-bold text-nb-gold">{contractId}</span>
            </div>
            <div className="w-px h-6 bg-nb-gold/20 mx-1" />
            <a
              href={`https://lora.algokit.io/testnet/application/${contractId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg hover:bg-nb-gold/20 text-nb-gold transition-all"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative z-10">
        {/* Left: Steps Flow */}
        <div className="w-full md:w-80 border-r border-white/5 p-6 bg-surface/30 backdrop-blur-sm shadow-xl overflow-y-auto">
          <div className="space-y-6">
            {STEPS.map((step, index) => {
              const isActive = step.id === buildStatus
              const isDone = buildStatus === 'complete' || (currentIndex !== -1 && index < currentIndex)
              const Icon = step.icon

              return (
                <div key={step.id} className="relative">
                  {/* Vertical connector line */}
                  {index < STEPS.length - 1 && (
                    <div className={cn(
                      "absolute left-4 top-10 w-px h-8 transition-colors duration-500",
                      isDone ? "bg-nb-gold/30" : "bg-white/5"
                    )} />
                  )}

                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-all duration-500 shadow-lg',
                        isDone ? 'bg-nb-gold/10 border-nb-gold/30 text-nb-gold' :
                          isActive ? 'bg-nb-gold border-nb-gold text-background shadow-nb-gold/20 scale-110' :
                            'bg-surface-2 border-white/5 text-muted/40'
                      )}
                    >
                      {isDone ? <Check className="h-4 w-4" /> : isActive ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                    </div>

                    <div className="flex-1 pt-0.5">
                      <p className={cn(
                        "text-xs font-bold uppercase tracking-tight",
                        isActive ? "text-nb-gold" : isDone ? "text-foreground" : "text-muted"
                      )}>
                        {step.label}
                      </p>
                      <p className="text-[10px] text-muted/60 leading-tight mt-0.5">{step.description}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <AnimatePresence>
            {buildStatus === 'awaiting_signature' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-10"
              >
                <DeploySignPrompt />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: Detailed Logs */}
        <div className="flex-1 flex flex-col bg-background/20 overflow-hidden">
          <div className="px-6 py-3 border-b border-white/5 bg-surface/50 backdrop-blur-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-nb-gold" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Raw System Logs</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-nb-gold animate-pulse" />
              <span className="text-[9px] font-mono text-muted uppercase tracking-tight">Listening for events...</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 font-mono text-xs scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
            {buildLogs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted/20 italic">
                No logs available for this session...
              </div>
            ) : (
              <div className="space-y-1.5 opacity-80">
                {buildLogs.map((log, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex gap-4 group"
                  >
                    <span className="text-muted/30 shrink-0 w-8 select-none text-right">0{i + 1}</span>
                    <span className="text-nb-gold/10 shrink-0 select-none">|</span>
                    <p className="flex-1 break-all transition-colors group-hover:text-foreground">{log}</p>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Error Footer */}
          {error && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              className="bg-nb-red/10 border-t border-nb-red/20 p-6 flex gap-4 backdrop-blur-xl"
            >
              <div className="w-10 h-10 rounded-xl bg-nb-red/20 flex items-center justify-center shrink-0 border border-nb-red/30">
                <AlertCircle className="w-6 h-6 text-nb-red" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-nb-red uppercase tracking-tight mb-1">Critical Build Error</h4>
                <p className="text-xs text-nb-red/80 font-medium leading-relaxed">{error}</p>
                <button className="mt-4 px-4 py-1.5 rounded-lg bg-nb-red/20 border border-nb-red/30 text-[10px] font-bold uppercase tracking-widest text-nb-red hover:bg-nb-red/30 transition-all">
                  Attempt Recovery
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}

function ExternalLink(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  )
}
