'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center pt-24 overflow-hidden px-6">
      {/* Background elements */}
      <div className="absolute inset-0 z-0 bg-mesh-subtle opacity-50 pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-nb-gold/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 left-1/3 -translate-x-1/2 w-[300px] h-[300px] bg-nb-navy/20 rounded-full blur-[100px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 text-center max-w-4xl"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-nb-gold/30 bg-nb-gold/5 text-nb-gold text-xs font-semibold mb-6 animate-pulse-glow">
          <Sparkles className="w-3.5 h-3.5" />
          <span>New: Algorand Puya Integration</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
          Build <span className="gradient-text">Algorand DApps</span> <br /> 
          with Natural Language
        </h1>
        
        <p className="text-muted text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed font-sans">
          AlgoCraft uses advanced AI to understand your requirements, generate secure Puya smart contracts, and deploy them on Algorand Testnet in seconds.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            href="/chat"
            className="group flex items-center gap-2 px-8 py-4 bg-nb-gold text-background font-bold rounded-full transition-all hover:scale-105 hover:bg-nb-gold/90 shadow-xl shadow-nb-gold/20"
          >
            Start Building
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <button className="px-8 py-4 bg-surface-2 border border-border font-bold rounded-full transition-all hover:bg-surface-2/80 hover:-translate-y-1">
            Explore Documentation
          </button>
        </div>
      </motion.div>

      {/* Floating abstract code preview (purely aesthetic) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
        className="relative z-10 mt-20 w-full max-w-5xl rounded-2xl border border-border bg-surface/50 backdrop-blur-xl p-4 shadow-2xl"
      >
        <div className="flex gap-1.5 mb-4 px-2">
          <div className="w-3 h-3 rounded-full bg-red-500/30" />
          <div className="w-3 h-3 rounded-full bg-amber-500/30" />
          <div className="w-3 h-3 rounded-full bg-emerald-500/30" />
        </div>
        <pre className="font-mono text-sm leading-relaxed text-muted/80 p-4 bg-background/50 rounded-xl overflow-hidden pointer-events-none">
          <code className="block">@arc4.contract</code>
          <code className="block">class Marketplace(arc4.ARC4Contract):</code>
          <code className="block">    def __init__(self) -&gt; None:</code>
          <code className="block text-nb-gold">        self.listings = GlobalState(arc4.UInt64)</code>
          <code className="block"></code>
          <code className="block">    @arc4.abimethod</code>
          <code className="block">    def create_listing(self, price: arc4.UInt64) -&gt; None:</code>
          <code className="block">        self.listings.set(price)</code>
          <code className="block text-nb-navy">        # AI Generated Business Logic...</code>
        </pre>
      </motion.div>
    </section>
  )
}
