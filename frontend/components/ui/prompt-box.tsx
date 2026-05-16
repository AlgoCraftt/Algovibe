'use client'

import React from 'react'
import { ArrowUp, Square } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PromptBoxProps {
  onSend?: (message: string) => void
  isLoading?: boolean
  placeholder?: string
  className?: string
}

export const PromptInputBox = React.forwardRef<HTMLDivElement, PromptBoxProps>(
  function PromptInputBox(
    { onSend = () => {}, isLoading = false, placeholder = 'Type your message here...', className },
    ref,
  ) {
    const [input, setInput] = React.useState('')

    const handleSubmit = () => {
      const trimmed = input.trim()
      if (!trimmed || isLoading) return
      onSend(trimmed)
      setInput('')
    }

    const hasContent = input.trim().length > 0

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-3xl border border-[#444444] bg-[#1F2023] p-2 shadow-[0_8px_30px_rgba(0,0,0,0.24)]',
          className,
        )}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          placeholder={placeholder}
          disabled={isLoading}
          rows={1}
          className="flex w-full min-h-[44px] resize-none rounded-md border-none bg-transparent px-3 py-2.5 text-base text-gray-100 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
        />

        <div className="flex items-center justify-end pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || !hasContent}
            title={isLoading ? 'Working…' : 'Send message'}
            className={cn(
              'inline-flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200',
              hasContent && !isLoading
                ? 'bg-white text-[#1F2023] hover:bg-white/80'
                : 'cursor-not-allowed bg-white/10 text-[#9CA3AF]',
            )}
          >
            {isLoading ? (
              <Square className="h-4 w-4 animate-pulse fill-current" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    )
  },
)
