'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useAlgoCraftStore } from '@/lib/store'
import { WalletButton } from '@/components/chat/WalletButton'
import { Loader2 } from 'lucide-react'

export function Navbar() {
  const { isBuilding } = useAlgoCraftStore()

  return (
    <nav className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-border bg-surface/50 backdrop-blur-md z-40 relative">
      <div className="flex items-center gap-2.5">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-nb-gold/10 flex items-center justify-center transition-all group-hover:bg-nb-gold/20 shadow-lg shadow-nb-gold/5">
            <Image src="/logo.png" alt="Logo" width={22} height={22} />
          </div>
          <span className="text-sm font-black tracking-widest uppercase text-foreground">
            AlgoCraft
          </span>
        </Link>

        {isBuilding && (
          <div className="ml-4 flex items-center gap-2 px-3 py-1 rounded-full bg-nb-gold/10 border border-nb-gold/20 text-[10px] font-bold text-nb-gold animate-pulse-glow">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Builder Online</span>
          </div>
        )}
      </div>

      <WalletButton />
    </nav>
  )
}
