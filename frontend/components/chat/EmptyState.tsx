'use client'

import React from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { PromptInputBox } from '@/components/ui/ai-prompt-box'
import { ProtocolChips } from './ProtocolChips'
import { useAlgoCraftStore } from '@/lib/store'

export function EmptyState() {
  const sendPrompt = useAlgoCraftStore((s) => s.sendPrompt)
  const isBuilding = useAlgoCraftStore((s) => s.isBuilding)

  const handleSend = (message: string) => {
    if (message.trim()) {
      sendPrompt(message)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-3xl px-6 py-12 text-center animate-fade-in-up">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.1 }}
        className="mb-8 rounded-3xl border border-nb-gold/20 p-6 bg-nb-gold/5 shadow-2xl shadow-nb-gold/10"
      >
        <Image src="/logo.png" alt="AlgoCraft" width={64} height={64} className="opacity-95" />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="text-4xl md:text-5xl font-bold tracking-tight mb-4"
      >
        What do you want to <span className="gradient-text">build?</span>
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="text-muted text-lg max-w-lg mb-10 leading-relaxed font-sans"
      >
        Describe your DApp in plain English. From DeFi to NFTs, I&apos;ll handle the code and deployment.
      </motion.p>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="w-full mb-8"
      >
        <PromptInputBox 
          onSend={handleSend} 
          isLoading={isBuilding} 
          placeholder="Describe your Algorand DApp idea..."
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.8 }}
        className="w-full"
      >
        <p className="text-[10px] text-muted uppercase tracking-[0.2em] font-bold mb-6 opacity-60">
          Try a template
        </p>
        <ProtocolChips onSelect={(text: string) => handleSend(text)} />
      </motion.div>
    </div>
  )
}
