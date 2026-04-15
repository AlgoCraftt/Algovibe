'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  Send, Loader2, X, Hexagon,
  ArrowLeftRight, Landmark, Image, Coins, Flame,
  Building2, Satellite, ShieldCheck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAlgoCraftStore } from '@/lib/store'

const PROTOCOL_ICONS: Record<string, LucideIcon> = {
  'algoswap': ArrowLeftRight,
  'algolend': Landmark,
  'algorand-nft': Image,
  'algorand-asa': Coins,
  'algorand-staking': Flame,
  'algorand-governance': Building2,
  'algorand-oracle': Satellite,
  'algorand-multisig': ShieldCheck,
}

function ChipIcon({ protocolId, className }: { protocolId: string; className?: string }) {
  const Icon = PROTOCOL_ICONS[protocolId] ?? Hexagon
  return <Icon className={className} />
}

interface PromptInputProps {
  onSubmit: (prompt: string) => void
  disabled?: boolean
  placeholder?: string
}

export function PromptInput({
  onSubmit,
  disabled = false,
  placeholder = 'Type a message...',
}: PromptInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const selectedDetails = useAlgoCraftStore((s) => s.getSelectedProtocolDetails())
  const removeSelectedProtocol = useAlgoCraftStore((s) => s.removeSelectedProtocol)

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`
    }
  }, [value])

  const handleSubmit = () => {
    if (!value.trim() || disabled) return
    onSubmit(value.trim())
    setValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const hasProtocols = selectedDetails.length > 0

  return (
    <div className="flex flex-col gap-2">
      {/* Selected protocol chips */}
      {hasProtocols && (
        <div className="flex flex-wrap gap-1.5">
          {selectedDetails.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full
                         bg-[var(--nb-gold)]/10 border border-[var(--nb-gold)]/25
                         text-[10px] font-medium text-[var(--nb-gold)] animate-fade-in-up"
            >
              <ChipIcon protocolId={p.id} className="w-3 h-3" />
              <span>{p.name}</span>
              <button
                onClick={() => removeSelectedProtocol(p.id)}
                className="ml-0.5 p-0.5 rounded-full hover:bg-[var(--nb-gold)]/20 transition-colors"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={hasProtocols ? 'Describe your DApp (protocols will be included)...' : placeholder}
          disabled={disabled}
          rows={1}
          className={cn(
            'flex-1 resize-none rounded-2xl border bg-[var(--surface-2)] px-4 py-3',
            'text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]',
            'focus:outline-none focus:ring-1 focus:ring-nb-gold/30 focus:border-nb-gold/40',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-all',
            hasProtocols ? 'border-[var(--nb-gold)]/30' : 'border-[var(--border-color)]'
          )}
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          style={{ backgroundColor: 'var(--nb-gold)', borderColor: 'var(--nb-gold)', color: '#ffffff' }}
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            'hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-all btn-press'
          )}
        >
          {disabled ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  )
}
