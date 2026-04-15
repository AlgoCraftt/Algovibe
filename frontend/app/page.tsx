'use client'

import React from 'react'
import { LandingNav } from '@/components/layout/LandingNav'
import { Hero } from '@/components/landing/Hero'
import { Features } from '@/components/landing/Features'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { CTA, Footer } from '@/components/landing/CTA'
import { motion, AnimatePresence } from 'framer-motion'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-nb-gold/30 selection:text-nb-gold">
      {/* Navigation */}
      <LandingNav />
      
      {/* Main Content */}
      <main className="relative">
        {/* Subtle background glow orbs */}
        <div className="fixed top-0 left-0 w-full h-full pointer-events-none opacity-20 -z-10">
          <div className="absolute top-[10%] left-[5%] w-[600px] h-[600px] bg-nb-gold/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-[20%] right-[10%] w-[500px] h-[500px] bg-nb-navy/10 rounded-full blur-[100px]" />
          <div className="absolute top-[40%] right-[30%] w-[400px] h-[400px] bg-nb-lilac/10 rounded-full blur-[110px]" />
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          {/* Hero Section */}
          <Hero />

          {/* Features Section */}
          <Features />

          {/* How It Works Section */}
          <HowItWorks />

          {/* Call to Action */}
          <CTA />
        </motion.div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  )
}
