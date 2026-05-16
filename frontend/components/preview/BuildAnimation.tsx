'use client'

import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useAlgoCraftStore, type BuildStep } from '@/lib/store'
import { DeploySignPrompt } from './DeploySignPrompt'
import { ContractCodeView } from './ContractCodeView'
import { formatBuildLog, statusHeadline } from '@/lib/build-log-format'
import {
  Brain,
  BookOpen,
  Code as CodeIcon,
  Hammer,
  Rocket,
  Layout,
  Check,
  Terminal,
  Cpu,
  PenLine,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS: {
  id: BuildStep
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { id: 'analyzing', label: 'Analyzing', icon: Brain },
  { id: 'retrieving_docs', label: 'Researching', icon: BookOpen },
  { id: 'generating_contract', label: 'Architecting', icon: CodeIcon },
  { id: 'compiling', label: 'Compiling', icon: Hammer },
  { id: 'deploying', label: 'Deploying', icon: Rocket },
  { id: 'awaiting_signature', label: 'Sign Tx', icon: PenLine },
  { id: 'generating_react', label: 'Finalizing UI', icon: Layout },
]

const CodeRain = () => {
  const chars = '01$?.&^*#@!/\\'.split('')
  return (
    <motion.div className="absolute inset-0 z-0 opacity-10 flex justify-between px-8 sm:px-16 pointer-events-none overflow-hidden">
      {[...Array(18)].map((_, i) => (
        <motion.div
          key={i}
          animate={{ y: ['-100%', '200%'] }}
          transition={{
            duration: 5 + Math.random() * 5,
            repeat: Infinity,
            ease: 'linear',
            delay: Math.random() * 5,
          }}
          className="text-[10px] font-mono text-nb-gold flex flex-col"
        >
          {[...Array(28)].map((_, j) => (
            <span key={j}>{chars[Math.floor(Math.random() * chars.length)]}</span>
          ))}
        </motion.div>
      ))}
    </motion.div>
  )
}

const HexGrid = () => (
  <div className="absolute inset-0 z-0 opacity-20 pointer-events-none overflow-hidden">
    <div
      className="absolute inset-0 bg-repeat"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='104' viewBox='0 0 60 104' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l30 17.3v34.6L30 69.3 0 52V17.3L30 0zm0 10l-21.2 12.2v24.4L30 59.3l21.2-12.7V22.2L30 10z' fill='%23f59e0b' fill-opacity='0.2' fill-rule='evenodd'/%3E%3C/svg%3E")`,
        backgroundSize: '60px 104px',
      }}
    />
  </div>
)

function stepIndex(status: BuildStep): number {
  if (status === 'error') return STEPS.findIndex((s) => s.id === 'compiling')
  const idx = STEPS.findIndex((s) => s.id === status)
  return idx >= 0 ? idx : 0
}

function BuildLogPanel({ logs, isError }: { logs: string[]; isError: boolean }) {
  const formatted = useMemo(() => logs.map(formatBuildLog), [logs])

  return (
    <div
      className={cn(
        'relative w-full max-w-2xl rounded-2xl border backdrop-blur-xl overflow-hidden',
        isError ? 'border-nb-red/40 bg-nb-red/5' : 'border-nb-gold/30 bg-surface/40',
      )}
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/5">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/40" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/40" />
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted">
          {isError ? <AlertCircle className="w-3 h-3 text-nb-red" /> : <Terminal className="w-3 h-3" />}
          <span>{isError ? 'Build log — issue' : 'Build log'}</span>
        </div>
      </div>
      <div className="p-4 font-mono text-xs h-40 sm:h-48 overflow-y-auto scrollbar-thin">
        <div className="space-y-2">
          {formatted.length === 0 ? (
            <span className="text-muted/60">Waiting for pipeline events…</span>
          ) : (
            formatted.slice(-12).map((log, i) => (
              <div
                key={`${i}-${log.slice(0, 24)}`}
                className={cn(
                  'flex gap-2 leading-relaxed',
                  log.includes('retry') || log.startsWith('⚠️') ? 'text-amber-400/90' : 'text-muted/85',
                  isError && i === formatted.length - 1 && 'text-nb-red/90',
                )}
              >
                <span className="text-nb-gold/50 shrink-0">[{String(i + 1).padStart(2, '0')}]</span>
                <span>{log}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export function BuildAnimation() {
  const { buildStatus, buildLogs, error, pendingSignature } = useAlgoCraftStore()

  const currentStepIndex = stepIndex(buildStatus)
  const progress = Math.max(8, Math.min(100, ((currentStepIndex + 0.4) / STEPS.length) * 100))
  const isAwaitingSignature = buildStatus === 'awaiting_signature'
  const isError = buildStatus === 'error'
  const showContract =
    isAwaitingSignature ||
    (buildStatus !== 'generating_react' &&
      buildStatus !== 'analyzing' &&
      buildStatus !== 'retrieving_docs')

  return (
    <div className="relative w-full h-full flex flex-col overflow-y-auto bg-background">
      <HexGrid />
      <CodeRain />
      <div className="absolute inset-0 z-0 opacity-15 pointer-events-none bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.12),transparent_50%)]" />

      <div className="relative z-10 flex flex-col items-center gap-8 px-4 py-8 max-w-5xl mx-auto w-full">
        <div className="relative w-52 h-52 flex items-center justify-center">
          <svg className="absolute inset-4 -rotate-90 w-[calc(100%-2rem)] h-[calc(100%-2rem)]">
            <circle cx="50%" cy="50%" r="42%" fill="none" stroke="currentColor" strokeWidth="3" className="text-white/5" />
            <motion.circle
              cx="50%"
              cy="50%"
              r="42%"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="3"
              strokeDasharray="400"
              animate={{ strokeDashoffset: 400 - (400 * progress) / 100 }}
              strokeLinecap="round"
            />
          </svg>
          <div className="z-10 flex flex-col items-center">
            <span className="text-4xl font-black gradient-text">{Math.round(progress)}%</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted mt-1">Pipeline</span>
          </div>
        </div>

        <div className="text-center space-y-1">
          <h2 className="text-lg font-black tracking-tight text-foreground">{statusHeadline(buildStatus)}</h2>
          {isError && error && (
            <p className="text-sm text-nb-red/90 max-w-lg mx-auto">{formatBuildLog(error)}</p>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-4 px-2">
          {STEPS.map((step, i) => {
            const isActive = step.id === buildStatus
            const isDone = currentStepIndex > i
            const Icon = step.icon
            return (
              <div key={step.id} className="flex flex-col items-center gap-2 w-[4.5rem]">
                <div
                  className={cn(
                    'w-11 h-11 rounded-xl flex items-center justify-center border transition-all',
                    isActive
                      ? 'bg-nb-gold/20 border-nb-gold text-nb-gold scale-105'
                      : isDone
                        ? 'bg-nb-gold/10 border-nb-gold/30 text-nb-gold'
                        : 'bg-surface-2 border-border text-muted/45',
                  )}
                >
                  {isDone ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                <span
                  className={cn(
                    'text-[9px] font-bold uppercase tracking-wider text-center',
                    isActive ? 'text-nb-gold' : isDone ? 'text-muted/75' : 'text-muted/40',
                  )}
                >
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>

        {isAwaitingSignature && pendingSignature && (
          <div className="w-full max-w-2xl space-y-4">
            <DeploySignPrompt variant="inline" />
            <ContractCodeView />
          </div>
        )}

        {showContract && !isAwaitingSignature && <ContractCodeView className="w-full max-w-2xl" />}

        <BuildLogPanel logs={buildLogs} isError={isError} />

        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted">
          <Cpu className="w-3 h-3 text-nb-gold" />
          Algorand Testnet
        </div>
      </div>
    </div>
  )
}



