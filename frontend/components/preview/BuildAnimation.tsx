'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAlgoCraftStore, type BuildStep } from '@/lib/store'
import { 
  Brain, 
  BookOpen, 
  Code as CodeIcon, 
  Hammer, 
  Rocket, 
  Layout, 
  Check, 
  Terminal,
  Cpu,
  Layers,
  Sparkles,
  PenLine
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Helpers & Data
// ---------------------------------------------------------------------------

const STEPS: { id: BuildStep; label: string; icon: any; color: string }[] = [
  { id: 'analyzing', label: 'Analyzing', icon: Brain, color: '#8b5cf6' },
  { id: 'retrieving_docs', label: 'Researching', icon: BookOpen, color: '#3b82f6' },
  { id: 'generating_contract', label: 'Architecting', icon: CodeIcon, color: '#14b8a6' },
  { id: 'compiling', label: 'Compiling', icon: Hammer, color: '#f59e0b' },
  { id: 'deploying', label: 'Deploying', icon: Rocket, color: '#fbbf24' },
  { id: 'awaiting_signature', label: 'Sign Tx', icon: PenLine, color: '#f59e0b' },
  { id: 'generating_react', label: 'Finalizing UI', icon: Layout, color: '#22c55e' },
]

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const HexGrid = () => (
  <div className="absolute inset-0 z-0 opacity-20 pointer-events-none overflow-hidden">
    <div 
      className="absolute inset-0 bg-repeat"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='104' viewBox='0 0 60 104' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l30 17.3v34.6L30 69.3 0 52V17.3L30 0zm0 10l-21.2 12.2v24.4L30 59.3l21.2-12.7V22.2L30 10z' fill='%23f59e0b' fill-opacity='0.2' fill-rule='evenodd'/%3E%3C/svg%3E")`,
        backgroundSize: '60px 104px'
      }}
    />
  </div>
)

const OrbitalRings = ({ progress }: { progress: number }) => (
  <div className="relative w-64 h-64 flex items-center justify-center">
    {/* Outer Ring */}
    <motion.div 
      animate={{ rotate: 360 }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      className="absolute inset-0 rounded-full border-2 border-dashed border-nb-gold/20"
    />
    {/* Middle Ring */}
    <motion.div 
      animate={{ rotate: -360 }}
      transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
      className="absolute inset-4 rounded-full border border-nb-navy/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
    />
    {/* Inner Progress Ring */}
    <svg className="absolute inset-8 w-48 h-48 -rotate-90">
      <circle
        cx="96"
        cy="96"
        r="80"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        className="text-white/5"
      />
      <motion.circle
        cx="96"
        cy="96"
        r="80"
        fill="none"
        stroke="url(#gold-gradient)"
        strokeWidth="4"
        strokeDasharray="502"
        animate={{ strokeDashoffset: 502 - (502 * progress) / 100 }}
        transition={{ duration: 1 }}
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="gold-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
      </defs>
    </svg>
    {/* Center Icon/Percent */}
    <div className="z-10 flex flex-col items-center">
       <span className="text-4xl font-black gradient-text">{Math.round(progress)}%</span>
       <span className="text-[10px] font-bold uppercase tracking-widest text-muted mt-1">Synchronizing</span>
    </div>
  </div>
)

const CodeRain = () => {
  const chars = "01$?.&^*#@!/\\".split("")
  return (
    <div className="absolute inset-0 z-0 opacity-10 flex justify-between px-12 pointer-events-none overflow-hidden">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          animate={{ y: ["-100%", "200%"] }}
          transition={{ 
            duration: 5 + Math.random() * 5, 
            repeat: Infinity, 
            ease: "linear",
            delay: Math.random() * 5
          }}
          className="text-[10px] font-mono text-nb-gold flex flex-col"
        >
          {[...Array(30)].map((_, j) => (
            <span key={j}>{chars[Math.floor(Math.random() * chars.length)]}</span>
          ))}
        </motion.div>
      ))}
    </div>
  )
}

const HolographicEditor = ({ logs }: { logs: string[] }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9, rotateX: 10 }}
    animate={{ opacity: 1, scale: 1, rotateX: 0 }}
    className="relative w-full max-w-2xl rounded-2xl border border-nb-gold/30 bg-surface/40 backdrop-blur-xl shadow-[0_0_50px_rgba(245,158,11,0.1)] overflow-hidden"
  >
    <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/5">
      <div className="flex gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/40" />
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/40" />
      </div>
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted">
        <Terminal className="w-3 h-3" />
        <span>Live Deployment Stream</span>
      </div>
    </div>
    
    <div className="p-6 font-mono text-xs text-muted/80 h-48 overflow-y-auto scrollbar-none">
      <div className="space-y-1.5">
        {logs.slice(-8).map((log, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex gap-3"
          >
            <span className="text-nb-gold/40 shrink-0 select-none">[{new Date().toLocaleTimeString([], { hour12: false, minute:'2-digit', second:'2-digit' })}]</span>
            <span className="text-nb-teal/80 mr-2 shrink-0 select-none">λ</span>
            <span className="truncate">{log}</span>
          </motion.div>
        ))}
        <div className="h-4 w-1 bg-nb-gold/60 animate-pulse inline-block align-middle ml-1" />
      </div>
    </div>

    {/* Holographic overlay shimmer */}
    <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-white/5 via-transparent to-white/5 opacity-50 mix-blend-overlay" />
  </motion.div>
)

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function BuildAnimation() {
  const { buildStatus, buildLogs } = useAlgoCraftStore()
  
  const currentStepIndex = STEPS.findIndex(s => s.id === buildStatus)
  const progress = Math.max(5, (currentStepIndex / (STEPS.length - 1)) * 100)

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-background overflow-hidden perspective-1000">
      {/* Background visual layers */}
      <HexGrid />
      <CodeRain />
      
      {/* Glow Orbs */}
      <div className="absolute top-1/4 -left-1/4 w-[600px] h-[600px] bg-nb-gold/5 rounded-full blur-[150px] animate-pulse" />
      <div className="absolute bottom-1/4 -right-1/4 w-[500px] h-[500px] bg-nb-navy/10 rounded-full blur-[120px] animate-pulse-glow" />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-12">
        
        {/* Orbital Progress */}
        <div className="animate-float">
          <OrbitalRings progress={progress} />
        </div>

        {/* Step Indicators */}
        <div className="flex flex-wrap justify-center gap-8 px-6">
          {STEPS.map((step, i) => {
            const isActive = step.id === buildStatus
            const isDone = currentStepIndex > i || buildStatus === 'complete'
            const Icon = step.icon

            return (
              <div key={step.id} className="flex flex-col items-center gap-3 w-20">
                <div 
                  className={cn(
                    "relative w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 border",
                    isActive ? "bg-nb-gold/20 border-nb-gold text-nb-gold shadow-[0_0_20px_rgba(245,158,11,0.3)] scale-110" : 
                    isDone ? "bg-nb-gold/10 border-nb-gold/30 text-nb-gold" : 
                    "bg-surface-2 border-border text-muted"
                  )}
                >
                  {isDone ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  
                  {isActive && (
                    <motion.div
                      layoutId="step-indicator"
                      className="absolute -inset-1 rounded-xl border border-nb-gold/50 animate-pulse-glow"
                    />
                  )}
                </div>
                <span className={cn(
                  "text-[10px] font-bold tracking-widest uppercase text-center leading-tight",
                   isActive ? "text-nb-gold" : isDone ? "text-muted/80" : "text-muted/40"
                )}>
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Live Editor Preview */}
        <HolographicEditor logs={buildLogs} />

        {/* Footer Info */}
        <div className="flex flex-col items-center gap-2">
           <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-surface-2/50 border border-border text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
              <Cpu className="w-3 h-3 text-nb-gold" />
              <span>Provisioning Algorand Testnet Node</span>
              <span className="w-1.5 h-1.5 rounded-full bg-nb-gold animate-pulse" />
           </div>
        </div>
      </div>
    </div>
  )
}
