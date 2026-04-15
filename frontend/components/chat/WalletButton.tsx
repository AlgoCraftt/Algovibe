'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { Wallet, Loader2, Copy, Check, ChevronDown, Power } from 'lucide-react'
import { cn } from '@/lib/utils'

function truncateAddress(address: string) {
  return `${address.slice(0, 5)}...${address.slice(-5)}`
}

export function WalletButton() {
  const { wallets, activeAddress, activeWallet } = useWallet()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [dropdownOpen])

  const copyAddress = () => {
    if (activeAddress) {
      navigator.clipboard.writeText(activeAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (activeAddress) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="group flex items-center gap-2 rounded-xl border border-nb-green/30 bg-nb-green/10 px-4 py-2 text-xs font-bold text-nb-green transition-all hover:bg-nb-green/20 btn-press glow-gold-sm"
        >
          <div className="h-2 w-2 rounded-full bg-nb-green animate-pulse" />
          <span className="font-mono tracking-tight">{truncateAddress(activeAddress)}</span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", dropdownOpen && "rotate-180")} />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-3 z-50 w-72 overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl animate-fade-in-up backdrop-blur-xl">
            <div className="p-4 bg-surface-2/50 border-b border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted">
                  Active Connection
                </span>
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-nb-green/10 text-nb-green text-[9px] font-bold border border-nb-green/20">
                  {activeWallet?.metadata.name}
                </span>
              </div>
              
              <div className="flex items-center gap-2 p-2 rounded-lg bg-background/50 border border-border">
                <p className="text-[11px] font-mono text-foreground break-all flex-1">
                  {activeAddress}
                </p>
                <button
                  onClick={copyAddress}
                  className="shrink-0 p-2 rounded-md hover:bg-surface-2 text-muted hover:text-nb-gold transition-all"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-nb-green" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
            
            <div className="p-2">
              <button
                onClick={() => { activeWallet?.disconnect(); setDropdownOpen(false) }}
                className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold text-nb-red transition-all hover:bg-nb-red/10 border border-transparent hover:border-nb-red/20"
              >
                <Power className="w-3.5 h-3.5" />
                Disconnect Wallet
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2.5 rounded-xl bg-nb-gold border border-nb-gold px-5 py-2 text-xs font-bold text-background transition-all hover:bg-nb-gold/90 hover:scale-105 active:scale-95 shadow-xl shadow-nb-gold/20"
      >
        <Wallet className="h-4 w-4" />
        <span>Connect Wallet</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", dropdownOpen && "rotate-180")} />
      </button>
      
      {dropdownOpen && (
        <div className="absolute right-0 top-full mt-3 z-50 w-56 overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl animate-fade-in-up backdrop-blur-xl">
          <div className="p-3 border-b border-border bg-surface-2/50">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted">
              Select Provider
            </span>
          </div>
          <div className="p-2 space-y-1">
            {wallets.map((wallet) => (
              <button
                key={wallet.id}
                onClick={() => { wallet.connect(); setDropdownOpen(false) }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold transition-all hover:bg-surface-2 hover:translate-x-1"
              >
                <img src={wallet.metadata.icon} alt={wallet.metadata.name} className="h-5 w-5 rounded-md" />
                <span>{wallet.metadata.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
