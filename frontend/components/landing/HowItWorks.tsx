'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { MessageSquare, LayoutPanelLeft, Share2 } from 'lucide-react'

const steps = [
  {
    icon: MessageSquare,
    title: 'Describe',
    description: 'Ask for a DApp in plain English. Ex: "Build a decentralized crowdfunding platform with milestones."',
  },
  {
    icon: LayoutPanelLeft,
    title: 'Build',
    description: 'AI generates, compiles, and tests smart contracts and frontends, giving you a live preview.',
  },
  {
    icon: Share2,
    title: 'Deploy',
    description: 'Instantly deploy to the Algorand testnet and publish to Vercel with one click.',
  },
]

export function HowItWorks() {
  return (
    <section className="py-24 px-6 max-w-7xl mx-auto overflow-hidden text-center relative z-10">
      <h2 className="text-3xl md:text-5xl font-bold mb-16">Three Simple Steps</h2>
      
      <div className="relative flex flex-col md:flex-row justify-between items-center gap-12 md:gap-4">
        {/* Connection line (desktop) */}
        <div className="hidden md:block absolute top-[60px] left-[15%] right-[15%] h-[2px] bg-gradient-to-r from-nb-gold/10 via-nb-gold/40 to-nb-gold/10 z-0" />
        
        {steps.map((step, i) => (
          <motion.div
            key={step.title}
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: i * 0.2 }}
            className="flex flex-col items-center max-w-[280px] z-10"
          >
            <div className="w-24 h-24 rounded-full flex items-center justify-center bg-surface border-4 border-nb-gold/20 shadow-2xl shadow-nb-gold/10 mb-8 transition-transform hover:scale-110">
              <step.icon className="w-10 h-10 text-nb-gold" />
            </div>
            <h3 className="text-xl font-bold mb-4">{step.title}</h3>
            <p className="text-muted text-sm leading-relaxed">
              {step.description}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
