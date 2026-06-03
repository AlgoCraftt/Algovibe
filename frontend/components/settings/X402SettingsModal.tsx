'use client'

import React from 'react'
import { X, Globe, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  loadX402Settings,
  saveX402Settings,
  clearX402Settings,
  type X402Settings,
} from '@/lib/x402-settings'

interface X402SettingsModalProps {
  open: boolean
  onClose: () => void
  onSaved?: () => void
}

export function X402SettingsModal({ open, onClose, onSaved }: X402SettingsModalProps) {
  const existing = loadX402Settings()

  const [serverUrl, setServerUrl] = React.useState(existing?.serverUrl ?? 'http://localhost:4021')
  const [endpoint, setEndpoint] = React.useState(existing?.endpoint ?? '/api/data')
  const [testing, setTesting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    const s = loadX402Settings()
    if (s) {
      setServerUrl(s.serverUrl)
      setEndpoint(s.endpoint)
    }
    setError(null)
    setSuccess(false)
  }, [open])

  const handleTestAndSave = async () => {
    const trimmedUrl = serverUrl.trim()
    if (!trimmedUrl) {
      setError('Server URL is required')
      return
    }
    if (!endpoint.trim()) {
      setError('Endpoint path is required')
      return
    }

    setTesting(true)
    setError(null)
    setSuccess(false)

    try {
      // Test: hit the health endpoint to verify server is reachable
      const healthUrl = `${trimmedUrl.replace(/\/$/, '')}/health`
      const resp = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) })
      if (!resp.ok) {
        throw new Error(`Server returned ${resp.status} — is it running?`)
      }
      const data = await resp.json()
      if (data.protocol !== 'x402') {
        throw new Error('Server responded but does not appear to be an x402 server (missing protocol: "x402" in /health)')
      }

      saveX402Settings({
        serverUrl: trimmedUrl,
        endpoint: endpoint.trim(),
        validated: true,
      })
      setSuccess(true)
      onSaved?.()
      setTimeout(() => onClose(), 600)
    } catch (e: any) {
      if (e.name === 'TimeoutError' || e.name === 'AbortError') {
        setError('Connection timed out — is the server running?')
      } else if (e.message?.includes('fetch')) {
        setError('Cannot reach server — check the URL and ensure CORS is enabled')
      } else {
        setError(e.message || 'Connection failed')
      }
    } finally {
      setTesting(false)
    }
  }

  const handleClear = () => {
    clearX402Settings()
    setServerUrl('http://localhost:4021')
    setEndpoint('/api/data')
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
            <Globe className="h-5 w-5 text-violet-400" />
            <h2 className="text-lg font-semibold text-foreground">x402 Server Settings</h2>
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
            Connect to your x402 resource server for real pay-per-call API access.
            The preview will perform a genuine HTTP 402 → sign → retry → serve flow.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wide">Server URL</label>
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => {
                setServerUrl(e.target.value)
                setError(null)
                setSuccess(false)
              }}
              placeholder="http://localhost:4021"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-400/40"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wide">Paid Endpoint</label>
            <input
              type="text"
              value={endpoint}
              onChange={(e) => {
                setEndpoint(e.target.value)
                setError(null)
                setSuccess(false)
              }}
              placeholder="/api/data"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-400/40"
            />
            <p className="text-xs text-muted">The path that returns 402 and requires payment</p>
          </div>

          <div className="rounded-lg border border-violet-400/20 bg-violet-400/5 p-3">
            <p className="text-xs text-violet-300 leading-relaxed">
              <strong>How it works:</strong> When configured, the preview calls your endpoint → gets 402 → 
              signs USDC payment via your wallet → retries with X-PAYMENT proof → gets real response.
            </p>
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
              Connected — x402 flow is live
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
                'flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white',
                'hover:bg-violet-400 disabled:opacity-60',
              )}
            >
              {testing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Testing…
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
