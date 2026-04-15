'use client'

import { useEffect } from 'react'
import { ChatLayout } from '@/components/chat/ChatLayout'
import { useAlgoCraftStore } from '@/lib/store'
import { useWallet } from '@txnlab/use-wallet-react'

function ThemeSync() {
  const theme = useAlgoCraftStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement
    // Force dark mode for redesign
    root.classList.add('dark')
    // Also sync from store if needed later
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      // In this redesign, we are dark-only, so we'll likely keep this forced
      root.classList.add('dark')
    }
  }, [theme])

  return null
}

function WalletSync() {
  const { activeAddress } = useWallet()
  const setWalletAddress = useAlgoCraftStore((s) => s.setWalletAddress)

  useEffect(() => {
    setWalletAddress(activeAddress ?? null)
  }, [activeAddress, setWalletAddress])

  return null
}

export default function ChatPage() {
  return (
    <main className="flex h-screen flex-col bg-background">
      <ThemeSync />
      <WalletSync />
      <ChatLayout />
    </main>
  )
}
