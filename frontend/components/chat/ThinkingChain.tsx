'use client'

import { useAlgoCraftStore, type BuildStep } from '@/lib/store'
import { cn } from '@/lib/utils'
import {
  Brain,
  BookOpen,
  Code,
  Hammer,
  Rocket,
  Layout,
  Check,
  AlertCircle,
  Loader2,
  Bot,
} from 'lucide-react'
import { motion } from 'framer-motion'

const STEPS: { id: BuildStep; label: string; thought: string; icon: any; color: string }[] = [
  { id: 'analyzing', label: 'Analyzing', thought: 'Understanding requirements...', icon: Brain, color: 'var(--nb-lilac)' },
  { id: 'retrieving_docs', label: 'Researching', thought: 'Fetching Puya documentation...', icon: BookOpen, color: 'var(--nb-navy)' },
  { id: 'generating_contract', label: 'Writing Code', thought: 'Generating smart contract...', icon: Code, color: 'var(--nb-teal)' },
  { id: 'compiling', label: 'Compiling', thought: 'Building AVM bytecode...', icon: Hammer, color: 'var(--nb-amber)' },
  { id: 'deploying', label: 'Deploying', thought: 'Publishing to Algorand...', icon: Rocket, color: 'var(--nb-gold)' },
  { id: 'generating_react', label: 'Building UI', thought: 'Creating React frontend...', icon: Layout, color: 'var(--nb-green)' },
]

export function ThinkingChain() {
  const { buildStatus, buildLogs, error, isBuilding } = useAlgoCraftStore()

  const currentStepId = buildStatus
  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStepId)
  const isComplete = buildStatus === 'complete'
  const isError = buildStatus === 'error'

  if (buildStatus === 'idle') return null

  return (
    <div className="flex gap-3 animate-fade-in-up mt-4">
      {/* Bot Avatar */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-2 border border-border text-nb-navy shadow-lg">
        <Bot className="h-4 w-4" />
      </div>

      {/* Thinking Chain */}
      <div className="flex-1 min-w-0">
        <div className="rounded-2xl border border-border bg-surface-2/60 backdrop-blur-md overflow-hidden shadow-xl">
          {/* Header */}
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              {!isComplete && !isError ? (
                <Loader2 className="h-3 w-3 animate-spin text-nb-gold" />
              ) : isComplete ? (
                <Check className="h-3 w-3 text-nb-green" />
              ) : (
                <AlertCircle className="h-3 w-3 text-nb-red" />
              )}
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground">
                {isComplete ? 'System Complete' : isError ? 'Execution Halted' : 'Thinking...'}
              </span>
            </div>
          </div>

          {/* Steps List */}
          <div className="p-3 space-y-1">
            {STEPS.map((step, index) => {
              const isActive = step.id === buildStatus
              const isStepComplete = isComplete || (currentStepIndex !== -1 && index < currentStepIndex)
              const isStepError = isError && index === currentStepIndex
              const shouldShow = (currentStepIndex !== -1 && index <= currentStepIndex) || isComplete

              if (!shouldShow && !isComplete) return null

              const Icon = step.icon

              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={cn(
                    'flex items-start gap-2.5 py-1.5 transition-all text-sm',
                    !isActive && !isStepComplete && !isStepError && 'opacity-40'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-md mt-0.5 border',
                      isStepComplete && 'bg-nb-green/10 border-nb-green/20 text-nb-green',
                      isActive && !isStepError && 'bg-nb-gold/10 border-nb-gold/30 text-nb-gold',
                      isStepError && 'bg-nb-red/10 border-nb-red/30 text-nb-red',
                      !isActive && !isStepComplete && !isStepError && 'bg-surface-2 border-border text-muted'
                    )}
                  >
                    {isStepComplete ? (
                      <Check className="h-3 w-3" />
                    ) : isActive && !isStepError ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : isStepError ? (
                      <AlertCircle className="h-3 w-3" />
                    ) : (
                      <Icon className="h-3 w-3" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                       <span className={cn(
                         'text-[11px] font-bold uppercase tracking-tight',
                         isStepComplete && 'text-nb-green',
                         isActive && !isStepError && 'text-nb-gold',
                         isStepError && 'text-nb-red'
                       )}>
                         {step.label}
                       </span>
                    </div>
                    {isActive && !isStepError && (
                      <p className="text-[10px] text-muted italic mt-0.5 leading-tight">
                        {step.thought}
                      </p>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Live Log */}
          {buildLogs.length > 0 && isBuilding && (
            <div className="px-3 pb-3">
              <div className="rounded-lg border border-border bg-background/50 px-2.5 py-1.5 overflow-hidden">
                <p className="text-[9px] font-mono text-muted/80 truncate">
                  <span className="text-nb-gold/60 mr-1.5">›</span>{buildLogs[buildLogs.length - 1]}
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="px-3 pb-3">
              <div className="rounded-lg border border-nb-red/20 bg-nb-red/5 p-2 flex gap-2">
                <AlertCircle className="h-3 w-3 text-nb-red shrink-0 mt-0.5" />
                <p className="text-[10px] font-medium text-nb-red">{error}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
