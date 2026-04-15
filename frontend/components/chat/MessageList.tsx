'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { User, Bot, AlertCircle } from 'lucide-react'
import Image from 'next/image'
import type { Message } from '@/lib/store'
import { useAlgoCraftStore } from '@/lib/store'
import { ThinkingChain } from './ThinkingChain'
import { motion, AnimatePresence } from 'framer-motion'

interface MessageListProps {
  messages: Message[]
}

export function MessageList({ messages }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { buildStatus } = useAlgoCraftStore()

  // Auto-scroll to bottom on new messages or build status changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, buildStatus])

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center bg-background/30 backdrop-blur-sm">
        <motion.div
           initial={{ opacity: 0, scale: 0.8 }}
           animate={{ opacity: 1, scale: 1 }}
           className="mb-8 rounded-3xl border border-nb-gold/20 p-5 bg-nb-gold/5 shadow-2xl shadow-nb-gold/10"
        >
          <Image src="/logo.png" alt="AlgoCraft" width={40} height={40} className="opacity-90" />
        </motion.div>
        
        <motion.div
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.2 }}
        >
          <h3 className="mb-2 text-xl font-bold tracking-tight text-foreground">
            AlgoCraft v1.0
          </h3>
          <p className="text-sm text-muted max-w-[240px] leading-relaxed">
            Your AI architect for building and deploying on Algorand.
          </p>
        </motion.div>
      </div>
    )
  }

  const showThinking = buildStatus !== 'idle' && buildStatus !== 'complete'

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto px-4 py-6 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
      <div className="space-y-6">
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {showThinking && (
            <motion.div
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ThinkingChain />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={cn(
        'flex gap-3 px-2',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-2 border border-border shadow-lg',
          isUser && 'bg-nb-gold/10 text-nb-gold border-nb-gold/30',
          !isUser && !isSystem && 'bg-nb-navy/10 text-nb-navy border-nb-navy/30',
          isSystem && 'bg-nb-red/10 text-nb-red border-nb-red/30'
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : isSystem ? (
          <AlertCircle className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>

      {/* Message Content */}
      <div
        className={cn(
          'flex max-w-[85%] flex-col',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-xl border backdrop-blur-md transition-all',
            isUser 
              ? 'bg-nb-gold/10 border-nb-gold/20 text-foreground rounded-tr-sm' 
              : !isSystem 
                ? 'bg-surface-2/60 border-border text-foreground rounded-tl-sm' 
                : 'bg-nb-red/5 border-nb-red/20 text-nb-red rounded-tl-sm'
          )}
        >
          {message.content}
        </div>
        <span className="mt-1.5 px-1 text-[9px] font-bold uppercase tracking-widest text-muted opacity-60">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </motion.div>
  )
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}
