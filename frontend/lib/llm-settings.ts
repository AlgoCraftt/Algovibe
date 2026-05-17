export type LlmProvider = 'openrouter' | 'openai' | 'anthropic'

export interface LlmModelOption {
  id: string
  label: string
}

export interface LlmSettings {
  provider: LlmProvider
  apiKey: string
  model: string
  /** Set after successful validation */
  validated?: boolean
}

const STORAGE_KEY = 'algovibe_llm_settings'

export const PROVIDER_LABELS: Record<LlmProvider, string> = {
  openrouter: 'OpenRouter',
  openai: 'OpenAI',
  anthropic: 'Anthropic (Claude)',
}

export const MODELS_BY_PROVIDER: Record<LlmProvider, LlmModelOption[]> = {
  openrouter: [
    { id: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash (preview)' },
    { id: 'google/gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (preview)' },
    { id: 'deepseek/deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
    { id: 'moonshotai/kimi-k2.6', label: 'Kimi K2.6' },
    { id: 'minimax/minimax-m2.7', label: 'MiniMax M2.7' },
    { id: 'tencent/hy3-preview', label: 'Tencent HY3 (preview)' },
  ],
  openai: [
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { id: 'o1-mini', label: 'o1-mini' },
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-20240620', label: 'Claude 3.5 Sonnet' },
    { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
    { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
  ],
}

export const DEFAULT_MODEL: Record<LlmProvider, string> = {
  openrouter: 'google/gemini-3-flash-preview',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-20240620',
}

export function loadLlmSettings(): LlmSettings | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LlmSettings
    if (!parsed.provider || !parsed.apiKey || !parsed.model) return null
    return parsed
  } catch {
    return null
  }
}

export function saveLlmSettings(settings: LlmSettings): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function clearLlmSettings(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}

export function isLlmConfigured(): boolean {
  const s = loadLlmSettings()
  return Boolean(s?.apiKey?.trim() && s?.model && s?.validated)
}

export function getDefaultModelForProvider(provider: LlmProvider): string {
  return DEFAULT_MODEL[provider]
}
