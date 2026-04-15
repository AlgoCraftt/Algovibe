'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { 
  ArrowLeftRight, 
  Image, 
  Flame, 
  Building2, 
  Users, 
  Coins 
} from 'lucide-react'

const TEMPLATES = [
  {
    id: 'dex',
    name: 'DEX',
    icon: ArrowLeftRight,
    prompt: 'Build a decentralized exchange (DEX) on Algorand where users can swap two assets.',
    color: '#3b82f6',
  },
  {
    id: 'nft',
    name: 'NFT Market',
    icon: Image,
    prompt: 'Create an NFT marketplace where users can mint and trade collections.',
    color: '#8b5cf6',
  },
  {
    id: 'staking',
    name: 'Staking',
    icon: Flame,
    prompt: 'Develop a staking platform where users can earn rewards for locking their ASAs.',
    color: '#f59e0b',
  },
  {
    id: 'gov',
    name: 'Governance',
    icon: Building2,
    prompt: 'Implement a governance protocol for community voting and proposals.',
    color: '#10b981',
  },
  {
    id: 'dao',
    name: 'DAO Hub',
    icon: Users,
    prompt: 'Build a DAO with treasury management and weighted voting mechanisms.',
    color: '#ef4444',
  },
  {
    id: 'asa',
    name: 'ASA Launchpad',
    icon: Coins,
    prompt: 'Create a launchpad for Algorand Standard Assets (ASAs) with vesting schedules.',
    color: '#06b6d4',
  },
]

interface ProtocolChipsProps {
  onSelect: (prompt: string) => void
}

export function ProtocolChips({ onSelect }: ProtocolChipsProps) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {TEMPLATES.map((tpl, i) => (
        <motion.button
          key={tpl.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: i * 0.05 }}
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelect(tpl.prompt)}
          className="group flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border border-border bg-surface-2/50 backdrop-blur-sm transition-all hover:border-nb-gold/30 hover:bg-surface-2 shadow-sm"
        >
          <div 
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"
            style={{ backgroundColor: `${tpl.color}15`, color: tpl.color }}
          >
            <tpl.icon className="w-4 h-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight">{tpl.name}</span>
        </motion.button>
      ))}
    </div>
  )
}
