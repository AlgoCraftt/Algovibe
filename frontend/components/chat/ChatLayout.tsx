'use client'

import React from 'react'
import { useAlgoCraftStore } from '@/lib/store'
import { EmptyState } from './EmptyState'
import { ChatSidebar } from './ChatSidebar'
import { BuildAnimation } from '@/components/preview/BuildAnimation'
import { PreviewPanel } from '@/components/preview/PreviewPanel'
import { motion, AnimatePresence } from 'framer-motion'
import { Navbar } from '@/components/layout/Navbar'

export function ChatLayout() {
  const { messages, buildStatus } = useAlgoCraftStore()

  const isInitialState = messages.length === 0 && buildStatus === 'idle'
  const showPreview =
    buildStatus === 'complete' || buildStatus === 'error' || buildStatus === 'fixing_frontend' || buildStatus === 'awaiting_signature'
  const showPipeline = !isInitialState && !showPreview

  return (
    <div className="flex h-screen flex-col bg-background text-foreground overflow-hidden">
      <Navbar />

      <div className="flex flex-1 min-h-0 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {isInitialState ? (
            <motion.div
              key="empty-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <EmptyState />
            </motion.div>
          ) : (
            <motion.div
              key="chat-main"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex w-full h-full"
            >
              <div className="w-[380px] h-full border-r border-border shrink-0 overflow-hidden relative z-10">
                <ChatSidebar />
              </div>

              <div className="flex-1 min-w-0 relative">
                {showPipeline && (
                  <motion.div
                    key="pipeline"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col"
                  >
                    <BuildAnimation />
                  </motion.div>
                )}

                {showPreview && (
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 flex flex-col"
                  >
                    <PreviewPanel />
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}


