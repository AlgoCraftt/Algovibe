'use client'

import React, { useState } from 'react'
import { useAlgoCraftStore } from '@/lib/store'
import { MessageList } from './MessageList'
import { ProtocolsPanel } from './ProtocolsPanel'
import { PromptInputBox } from '@/components/ui/ai-prompt-box'
import { 
  MessageSquare, 
  Layers, 
  Plus,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function ChatSidebar() {
  const { messages, sendPrompt, isBuilding, reset } = useAlgoCraftStore()
  const [showProtocols, setShowProtocols] = useState(false)

  const handleSend = (text: string) => {
    if (text.trim()) {
      sendPrompt(text)
    }
  }

  return (
    <div className="flex flex-col h-full bg-surface border-r border-border shadow-2xl relative z-20">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface/50 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-nb-gold/10 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-nb-gold" />
          </div>
          <span className="text-sm font-bold tracking-tight">Chat</span>
        </div>
        
        <button
          onClick={reset}
          className="p-2 rounded-lg hover:bg-surface-2 transition-colors text-muted hover:text-foreground"
          title="New Chat"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <MessageList messages={messages} />
      </div>

      {/* Protocols Section (Collapsible) */}
      <div className="border-t border-border">
        <button
          onClick={() => setShowProtocols(!showProtocols)}
          className="w-full flex items-center justify-between px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted hover:text-foreground hover:bg-surface-2/50 transition-all"
        >
          <div className="flex items-center gap-2">
            <Layers className="w-3 h-3" />
            <span>Protocols & Capabilities</span>
          </div>
          {showProtocols ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
        </button>
        
        <div className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out bg-background/30",
          showProtocols ? "max-h-[300px] border-b border-border" : "max-h-0"
        )}>
          <div className="h-[300px]">
             <ProtocolsPanel />
          </div>
        </div>
      </div>

      {/* Sidebar Prompt Input */}
      <div className="p-4 bg-surface/80 backdrop-blur-md border-t border-border">
        <PromptInputBox 
          onSend={handleSend}
          isLoading={isBuilding}
          placeholder="Ask a follow-up..."
          className="!shadow-none border-border bg-surface-2/50"
        />
      </div>
    </div>
  )
}
