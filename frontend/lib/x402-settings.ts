/**
 * x402 Server Settings
 * 
 * Allows users to configure their x402 resource server endpoint.
 * When set, the preview does a REAL x402 round trip:
 *   fetch(endpoint) → 402 → sign payment via bridge → retry with X-PAYMENT → real response
 * 
 * When not set, the preview uses the mock flow (real on-chain payment, fake response).
 */

export interface X402Settings {
  /** The x402 resource server URL (e.g. http://localhost:4021 or https://your-server.com) */
  serverUrl: string
  /** The paid endpoint path (e.g. /api/data) */
  endpoint: string
  /** Whether settings have been validated */
  validated?: boolean
}

const STORAGE_KEY = 'algovibe_x402_settings'

export function loadX402Settings(): X402Settings | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as X402Settings
    if (!parsed.serverUrl) return null
    return parsed
  } catch {
    return null
  }
}

export function saveX402Settings(settings: X402Settings): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function clearX402Settings(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}

export function isX402Configured(): boolean {
  const s = loadX402Settings()
  return Boolean(s?.serverUrl?.trim())
}

/**
 * Build the full paid endpoint URL from settings.
 * e.g. serverUrl="http://localhost:4021", endpoint="/api/data" → "http://localhost:4021/api/data"
 */
export function getX402EndpointUrl(settings: X402Settings): string {
  const base = settings.serverUrl.replace(/\/$/, '')
  const path = settings.endpoint.startsWith('/') ? settings.endpoint : `/${settings.endpoint}`
  return `${base}${path}`
}
