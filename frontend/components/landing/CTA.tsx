'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

export function CTA() {
  return (
    <section className="py-24 px-6 relative overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="max-w-5xl mx-auto rounded-3xl bg-gradient-to-r from-nb-gold/20 via-nb-gold/40 to-nb-gold/20 p-12 text-center border border-nb-gold/30 shadow-2xl shadow-nb-gold/10"
      >
        <h2 className="text-3xl md:text-5xl font-bold mb-6">Ready to Build Your DApp?</h2>
        <p className="text-lg text-muted/90 max-w-2xl mx-auto mb-10">
          Join hundreds of developers building the next generation of decentralized applications on Algorand. No coding required.
        </p>
        
        <Link
          href="/chat"
          className="inline-flex items-center gap-2 px-10 py-5 bg-nb-gold text-background font-bold rounded-full transition-all hover:scale-105 hover:bg-nb-gold/90 shadow-xl shadow-nb-gold/40 active:scale-95"
        >
          Get Started Now
          <ArrowRight className="w-5 h-5" />
        </Link>
      </motion.div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="py-12 border-t border-border px-6 text-center text-muted text-sm relative z-10 bg-background/50 backdrop-blur-md">
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-nb-gold/10 flex items-center justify-center">
            <span className="text-nb-gold font-bold">A</span>
          </div>
          <span className="text-lg font-bold text-foreground">AlgoCraft</span>
        </div>
        <p>&copy; 2026 AlgoCraft. Built with ❤️ on Algorand.</p>
        <div className="flex gap-6 mt-4">
          <a href="#" className="hover:text-nb-gold transition-colors">Twitter</a>
          <a href="#" className="hover:text-nb-gold transition-colors">GitHub</a>
          <a href="#" className="hover:text-nb-gold transition-colors">Discord</a>
        </div>
      </div>
    </footer>
  )
}
