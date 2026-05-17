'use client'

import React from 'react'
import { X, KeyRound, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  type LlmProvider,
  PROVIDER_LABELS,
  MODELS_BY_PROVIDER,
  DEFAULT_MODEL,
  loadLlmSettings,
  saveLlmSettings,
  clearLlmSettings,
} from '@/lib/llm-settings'
import { validateLlmCredentials } from '@/lib/api'

interface LlmSettingsModalProps {
  open: boolean
  onClose: () => void
  onSaved?: () => void
}

export function LlmSettingsModal({ open, onClose, onSaved }: LlmSettingsModalProps) {
  const existing = loadLlmSettings()

  const [provider, setProvider] = React.useState<LlmProvider>(existing?.provider ?? 'openrouter')
  const [apiKey, setApiKey] = React.useState(existing?.apiKey ?? '')
  const [model, setModel] = React.useState(
    existing?.model ?? DEFAULT_MODEL[existing?.provider ?? 'openrouter'],
  )
  const [testing, setTesting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    const s = loadLlmSettings()
    if (s) {
      setProvider(s.provider)
      setApiKey(s.apiKey)
      setModel(s.model)
    }
    setError(null)
    setSuccess(false)
  }, [open])

  const models = MODELS_BY_PROVIDER[provider]

  const handleProviderChange = (next: LlmProvider) => {
    setProvider(next)
    setModel(DEFAULT_MODEL[next])
    setError(null)
    setSuccess(false)
  }

  const handleTestAndSave = async () => {
    const trimmedKey = apiKey.trim()
    if (!trimmedKey) {
      setError('API key is required')
      return
    }
    if (!model) {
      setError('Select a model')
      return
    }

    setTesting(true)
    setError(null)
    setSuccess(false)

    try {
      await validateLlmCredentials({
        provider,
        api_key: trimmedKey,
        model,
      })
      saveLlmSettings({
        provider,
        apiKey: trimmedKey,
        model,
        validated: true,
      })
      setSuccess(true)
      onSaved?.()
      setTimeout(() => onClose(), 600)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Validation failed')
    } finally {
      setTesting(false)
    }
  }

  const handleClear = () => {
    clearLlmSettings()
    setApiKey('')
    setError(null)
    setSuccess(false)
    onSaved?.()
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-nb-gold" />
            <h2 className="text-lg font-semibold text-foreground">AI Settings</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-background hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <p className="text-sm text-muted leading-relaxed">
            Your API key is stored in this browser session only and sent to the backend for each build.
            We do not store keys on our servers.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wide">Provider</label>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as LlmProvider)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-nb-gold/40"
            >
              {(Object.keys(PROVIDER_LABELS) as LlmProvider[]).map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABELS[p]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wide">API key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value)
                setError(null)
                setSuccess(false)
              }}
              placeholder={
                provider === 'openrouter'
                  ? 'sk-or-...'
                  : provider === 'openai'
                    ? 'sk-...'
                    : 'sk-ant-...'
              }
              autoComplete="off"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-nb-gold/40"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wide">Model</label>
            <select
              value={model}
              onChange={(e) => {
                setModel(e.target.value)
                setError(null)
                setSuccess(false)
              }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-nb-gold/40"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 rounded-lg border border-nb-green/30 bg-nb-green/10 px-3 py-2.5 text-sm text-nb-green">
              <CheckCircle2 className="h-4 w-4" />
              Saved — you can start building
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={handleClear}
            className="text-sm text-muted hover:text-foreground"
          >
            Clear
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:bg-background"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleTestAndSave}
              disabled={testing}
              className={cn(
                'flex items-center gap-2 rounded-lg bg-nb-gold px-4 py-2 text-sm font-semibold text-background',
                'hover:bg-nb-gold/90 disabled:opacity-60',
              )}
            >
              {testing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying…
                </>
              ) : (
                'Test & save'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
