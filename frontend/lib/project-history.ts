/**
 * Local project history — persists completed builds to localStorage.
 * No backend or DB needed. Stores only metadata + generated files.
 */

export interface ProjectRecord {
  id: string
  prompt: string
  templateType: string | null
  contractId: string | null
  framework: string
  createdAt: string // ISO string
  files: Record<string, string>
  arc32Spec: any | null
  contractSpec: Record<string, unknown> | null
}

const STORAGE_KEY = 'algovibe_project_history'
const MAX_PROJECTS = 20

export function getProjectHistory(): ProjectRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ProjectRecord[]
    return parsed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  } catch {
    return []
  }
}

export function saveProject(project: Omit<ProjectRecord, 'id' | 'createdAt'>): ProjectRecord {
  const record: ProjectRecord = {
    ...project,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }

  const history = getProjectHistory()
  // Avoid duplicates if same prompt + contractId combo exists
  const dedupedHistory = history.filter(
    (p) => !(p.prompt === record.prompt && p.contractId === record.contractId)
  )
  const updated = [record, ...dedupedHistory].slice(0, MAX_PROJECTS)

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // Storage full — evict oldest entries
    const trimmed = updated.slice(0, 5)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  }

  return record
}

export function deleteProject(id: string): void {
  const history = getProjectHistory()
  const updated = history.filter((p) => p.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
}

export function getProject(id: string): ProjectRecord | null {
  const history = getProjectHistory()
  return history.find((p) => p.id === id) || null
}

export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY)
}
