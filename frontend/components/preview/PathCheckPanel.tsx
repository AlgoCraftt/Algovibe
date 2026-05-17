'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { CheckCircle2, XCircle, AlertTriangle, MinusCircle, Route } from 'lucide-react'
import type { PathReport } from '@/lib/store'

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'ok':
      return <CheckCircle2 className="h-3.5 w-3.5 text-nb-green shrink-0" />
    case 'blocked':
      return <XCircle className="h-3.5 w-3.5 text-nb-red shrink-0" />
    case 'warning':
      return <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
    default:
      return <MinusCircle className="h-3.5 w-3.5 text-muted shrink-0" />
  }
}

export function PathCheckPanel({ report, compact }: { report: PathReport; compact?: boolean }) {
  const score = report.score ?? (report.open_paths / Math.max(1, report.total_paths))
  const steps = report.steps ?? []

  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-surface/60 backdrop-blur-md overflow-hidden',
        compact ? 'text-xs' : 'text-sm',
      )}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/5 bg-white/5">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-nb-gold" />
          <span className="font-bold text-foreground">Path check</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full',
              score >= 0.9
                ? 'bg-nb-green/15 text-nb-green'
                : score >= 0.7
                  ? 'bg-amber-500/15 text-amber-400'
                  : 'bg-nb-red/15 text-nb-red',
            )}
          >
            {report.open_paths}/{report.total_paths} open
          </span>
        </div>
      </div>

      <div className={cn('overflow-y-auto scrollbar-thin', compact ? 'max-h-48' : 'max-h-72')}>
        <ul className="divide-y divide-white/5">
          {steps.map((step) => (
            <li key={step.id} className="flex gap-2.5 px-4 py-2.5 hover:bg-white/[0.02]">
              <StatusIcon status={step.status} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-foreground/90 truncate">{step.label}</div>
                <p className="text-muted leading-snug mt-0.5">{step.message}</p>
                {step.fix_hint && step.status === 'blocked' && (
                  <p className="text-nb-gold/80 text-[11px] mt-1">→ {step.fix_hint}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {(report.blockages?.length ?? 0) > 0 && (
        <div className="px-4 py-2 border-t border-nb-red/20 bg-nb-red/5 text-[11px] text-nb-red/90">
          {report.blockages.length} blockage(s) — preview may fail until fixed
        </div>
      )}
    </div>
  )
}
