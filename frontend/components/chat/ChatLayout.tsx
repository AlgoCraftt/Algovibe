'use client'

import React, { useState } from 'react'
import { useAlgoCraftStore } from '@/lib/store'
import { EmptyState } from './EmptyState'
import { ChatSidebar } from './ChatSidebar'
import { BuildAnimation } from '@/components/preview/BuildAnimation'
import { PreviewPanel } from '@/components/preview/PreviewPanel'
import { DeploySignPrompt } from '@/components/preview/DeploySignPrompt'
import { motion, AnimatePresence } from 'framer-motion'
import { Navbar } from '@/components/layout/Navbar'
import { Maximize2, Minimize2 } from 'lucide-react'

export function ChatLayout() {
  const { messages, buildStatus, pendingSignature } = useAlgoCraftStore()
  
  const isInitialState = messages.length === 0 && buildStatus === 'idle'
  const isBuilding = buildStatus !== 'idle' && buildStatus !== 'complete' && buildStatus !== 'error'
  const isAwaitingSignature = buildStatus === 'awaiting_signature'

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
              {/* Sidebar with messages */}
              <div
                className="w-[380px] h-full border-r border-border shrink-0 overflow-hidden relative z-10"
              >
                <ChatSidebar />
              </div>

              <div className="flex-1 min-w-0 relative">

                {/* Show build animation while building (not awaiting signature) */}
                {isBuilding && !isAwaitingSignature && (
                  <div className="absolute inset-0 flex flex-col">
                    <BuildAnimation />
                  </div>
                )}

                {/* Show preview panel when complete or awaiting signature */}
                {(!isBuilding || isAwaitingSignature) && (
                  <div className="absolute inset-0 flex flex-col">
                    <PreviewPanel />
                  </div>
                )}

                {/* SIGNING OVERLAY — always on top when awaiting signature AND we have a pending signature to show */}
                {isAwaitingSignature && pendingSignature && (
                  <div
                    style={{ zIndex: 9999 }}
                    className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-md"
                  >
                    <div className="w-full max-w-md mx-6">
                      <DeploySignPrompt />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
