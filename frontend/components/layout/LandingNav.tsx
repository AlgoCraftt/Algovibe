'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'

export function LandingNav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-md bg-background/50 border-b border-border">
      <div className="flex items-center gap-2.5">
        <Image src="/logo.png" alt="AlgoCraft Logo" width={32} height={32} />
        <span className="text-xl font-bold tracking-tight text-foreground uppercase">
          AlgoCraft
        </span>
      </div>
      
      <div className="flex items-center gap-6">
        <Link 
          href="/chat"
          className="px-5 py-2 text-sm font-semibold text-background bg-nb-gold rounded-full transition-all hover:bg-nb-gold/90 hover:scale-105 active:scale-95 shadow-lg shadow-nb-gold/20"
        >
          Launch App
        </Link>
      </div>
    </nav>
  )
}
