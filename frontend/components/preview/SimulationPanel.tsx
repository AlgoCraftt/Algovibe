'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { CheckCircle2, XCircle, AlertTriangle, MinusCircle, FlaskConical } from 'lucide-react'
import type { SimulationReport } from '@/lib/store'

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'ok':
      return <CheckCircle2 className="h-3.5 w-3.5 text-nb-green shrink-0" />
    case 'failed':
      return <XCircle className="h-3.5 w-3.5 text-nb-red shrink-0" />
    case 'warning':
      return <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
    default:
      return <MinusCircle className="h-3.5 w-3.5 text-muted shrink-0" />
  }
}

export function SimulationPanel({
  report,
  compact,
}: {
  report: SimulationReport
  compact?: boolean
}) {
  if (!report.enabled && report.skipped_reason) {
    return (
      <div
        className={cn(
          'rounded-2xl border border-border/80 bg-surface/40 px-4 py-3 text-muted',
          compact ? 'text-xs' : 'text-sm',
        )}
      >
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-muted" />
          <span>On-chain simulation skipped — {report.skipped_reason}</span>
        </div>
      </div>
    )
  }

  if (!report.enabled) return null

  const score = report.score ?? report.passed / Math.max(1, report.total)

  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-surface/60 backdrop-blur-md overflow-hidden',
        compact ? 'text-xs' : 'text-sm',
      )}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/5 bg-white/5">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-nb-teal" />
          <span className="font-bold text-foreground">Testnet simulation</span>
        </div>
        <span
          className={cn(
            'text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full',
            score >= 0.9
              ? 'bg-nb-green/15 text-nb-green'
              : score >= 0.5
                ? 'bg-amber-500/15 text-amber-400'
                : 'bg-nb-red/15 text-nb-red',
          )}
        >
          {report.passed}/{report.total} passed
        </span>
      </div>
      <div className={cn('overflow-y-auto scrollbar-thin', compact ? 'max-h-40' : 'max-h-56')}>
        <ul className="divide-y divide-white/5">
          {(report.steps || []).map((step) => (
            <li key={step.id} className="flex gap-2.5 px-4 py-2.5">
              <StatusIcon status={step.status} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-foreground/90 truncate">{step.label}</div>
                <p className="text-muted leading-snug mt-0.5">{step.message}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
