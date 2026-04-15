'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useAlgoCraftStore } from '@/lib/store'
import { WalletButton } from '@/components/chat/WalletButton'
import { 
  Plus, 
  Settings, 
  ExternalLink, 
  UploadCloud,
  Check,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function Navbar() {
  const { 
    isBuilding, 
    buildStatus, 
    reset, 
    deployToVercel, 
    isDeployingToVercel, 
    vercelUrl 
  } = useAlgoCraftStore()

  const isComplete = buildStatus === 'complete'

  return (
    <nav className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-border bg-surface/50 backdrop-blur-md z-40 relative">
      {/* Left: Brand */}
      <div className="flex items-center gap-2.5">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-nb-gold/10 flex items-center justify-center transition-all group-hover:bg-nb-gold/20 shadow-lg shadow-nb-gold/5">
            <Image src="/logo.png" alt="Logo" width={22} height={22} />
          </div>
          <span className="text-sm font-black tracking-widest uppercase text-foreground">
            AlgoCraft
          </span>
        </Link>
        
        {/* Status indicator */}
        {isBuilding && (
          <div className="ml-4 flex items-center gap-2 px-3 py-1 rounded-full bg-nb-gold/10 border border-nb-gold/20 text-[10px] font-bold text-nb-gold animate-pulse-glow">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Builder Online</span>
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-4">
        {isComplete && (
          <div className="flex items-center gap-2 mr-2">
            {!vercelUrl ? (
              <button
                onClick={deployToVercel}
                disabled={isDeployingToVercel}
                className="flex items-center gap-2 px-4 py-2 bg-surface-2 border border-border rounded-xl text-xs font-bold transition-all hover:bg-nb-gold/10 hover:border-nb-gold/30 hover:text-nb-gold disabled:opacity-50"
              >
                {isDeployingToVercel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                Publish to Vercel
              </button>
            ) : (
              <a
                href={vercelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-nb-green/10 border border-nb-green/30 text-nb-green rounded-xl text-xs font-bold transition-all hover:bg-nb-green/20"
              >
                <Check className="w-3.5 h-3.5" />
                Live on Vercel
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        <button 
          onClick={reset}
          className="p-2.5 rounded-xl bg-surface-2 border border-border text-muted hover:text-foreground transition-all flex items-center gap-2 group"
          title="Start fresh"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden md:inline text-[10px] font-bold uppercase tracking-tight">New Build</span>
        </button>
        
        <div className="h-6 w-px bg-border mx-1" />
        
        <WalletButton />
        
        <button className="p-2.5 rounded-xl bg-surface-2 border border-border text-muted hover:text-foreground transition-all">
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </nav>
  )
}
