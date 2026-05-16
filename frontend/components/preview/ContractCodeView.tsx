'use client'

import { useMemo } from 'react'
import { useAlgoCraftStore } from '@/lib/store'
import { FileCode } from 'lucide-react'
import { cn } from '@/lib/utils'

const CONTRACT_EXT = /\.(algo\.ts|py|teal)$/i

export function ContractCodeView({ className }: { className?: string }) {
  const generatedFiles = useAlgoCraftStore((s) => s.generatedFiles)

  const { path, content } = useMemo(() => {
    for (const [p, c] of Object.entries(generatedFiles)) {
      if (CONTRACT_EXT.test(p)) return { path: p.replace(/^\//, ''), content: c }
    }
    const first = Object.entries(generatedFiles)[0]
    return first
      ? { path: first[0].replace(/^\//, ''), content: first[1] }
      : { path: '', content: '' }
  }, [generatedFiles])

  if (!content) {
    return (
      <div className={cn('flex h-48 items-center justify-center text-sm text-muted', className)}>
        Waiting for contract source…
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border border-nb-gold/25 bg-surface/60 backdrop-blur-xl',
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-white/5 bg-white/5 px-4 py-2">
        <FileCode className="h-4 w-4 text-nb-gold" />
        <span className="font-mono text-xs font-bold text-foreground">{path}</span>
        <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-muted">
          Smart contract
        </span>
      </div>
      <pre className="max-h-64 overflow-auto p-4 font-mono text-[11px] leading-relaxed text-muted/90 scrollbar-thin">
        {content}
      </pre>
    </div>
  )
}
