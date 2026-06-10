'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Clock, Trash2, Code2, ExternalLink } from 'lucide-react'
import { getProjectHistory, deleteProject, type ProjectRecord } from '@/lib/project-history'
import { useAlgoCraftStore } from '@/lib/store'

function getTimeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

function getTemplateIcon(templateType: string | null): string {
  switch (templateType) {
    case 'voting': return '🗳️'
    case 'crowdfunding': return '💰'
    case 'nft': return '🖼️'
    case 'dao': return '🏛️'
    case 'token': return '🪙'
    case 'marketplace': return '🛒'
    case 'x402_service': return '💳'
    default: return '⚡'
  }
}

export function ProjectHistory() {
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const loadProject = useAlgoCraftStore((s) => s.loadProject)

  useEffect(() => {
    setProjects(getProjectHistory())
  }, [])

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    deleteProject(id)
    setProjects(getProjectHistory())
  }

  if (projects.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 1.0 }}
      className="w-full mt-10"
    >
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-3.5 h-3.5 text-muted" />
        <p className="text-[10px] text-muted uppercase tracking-[0.2em] font-bold opacity-60">
          Recent Projects
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {projects.slice(0, 6).map((project, index) => (
          <motion.button
            key={project.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 1.0 + index * 0.08 }}
            onClick={() => loadProject(project.id)}
            className="group relative text-left p-4 rounded-xl border border-border/50 bg-surface/30 hover:bg-surface/60 hover:border-nb-gold/30 transition-all duration-200 cursor-pointer"
          >
            {/* Delete button */}
            <button
              onClick={(e) => handleDelete(e, project.id)}
              className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-muted hover:text-red-400 transition-all"
              title="Remove from history"
            >
              <Trash2 className="w-3 h-3" />
            </button>

            {/* Content */}
            <div className="flex items-start gap-3">
              <span className="text-lg shrink-0 mt-0.5">
                {getTemplateIcon(project.templateType)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate pr-6">
                  {project.prompt.length > 50
                    ? project.prompt.slice(0, 50) + '…'
                    : project.prompt}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  {project.templateType && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-nb-gold/10 text-nb-gold font-medium">
                      {project.templateType}
                    </span>
                  )}
                  {project.contractId && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-green-500/10 text-green-400 font-medium flex items-center gap-1">
                      <Code2 className="w-2.5 h-2.5" />
                      App {project.contractId}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted mt-1.5">
                  {getTimeAgo(project.createdAt)}
                </p>
              </div>
            </div>

            {/* Hover indicator */}
            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <ExternalLink className="w-3 h-3 text-nb-gold/60" />
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}
