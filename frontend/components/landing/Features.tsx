'use client'

import React from 'react'
import { Brain, Code, Rocket, Eye } from 'lucide-react'
import { motion } from 'framer-motion'

const features = [
  {
    icon: Brain,
    title: 'AI-Powered',
    description: 'Our advanced LLM understands your high-level business requirements and translates them into execution plans.',
    color: 'var(--nb-lilac)',
  },
  {
    icon: Code,
    title: 'Smart Contracts',
    description: 'Auto-generates secure, audited Puya smart contracts in both Python and TypeScript flavors for Algorand.',
    color: 'var(--nb-teal)',
  },
  {
    icon: Rocket,
    title: 'One-Click Deploy',
    description: 'Vercel-integrated deployments that put your DApp on the Algorand testnet instantly.',
    color: 'var(--nb-gold)',
  },
  {
    icon: Eye,
    title: 'Live Preview',
    description: 'See your frontend live as the AI builds. Interact with real smart contracts in our Sandpack environment.',
    color: 'var(--nb-green)',
  },
]

export function Features() {
  return (
    <section className="py-24 px-6 max-w-7xl mx-auto overflow-hidden relative">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-5xl font-bold mb-4">Powerful Features</h2>
        <p className="text-muted text-lg max-w-2xl mx-auto">
          Everything you need to go from idea to a fully functioning DApp on Algorand.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
        {features.map((feature, i) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="group p-8 rounded-2xl border border-border bg-surface/50 backdrop-blur-sm transition-all hover:bg-surface hover:-translate-y-2 hover:border-nb-gold/20"
          >
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 shadow-lg shadow-black/20"
              style={{ backgroundColor: `${feature.color}15`, color: feature.color }}
            >
              <feature.icon className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
            <p className="text-muted text-sm leading-relaxed">
              {feature.description}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
