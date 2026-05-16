/** Paths injected for Sandpack runtime only — hidden from file tree & editor tabs. */
const INTERNAL_PATTERNS = [
  /^\/mock-/,
  /^mock-/,
  /^\/index\.tsx$/,
  /^index\.tsx$/,
  /^\/index\.css$/,
  /^index\.css$/,
  /^\/lib\/algorand\.ts$/,
  /^lib\/algorand\.ts$/,
]

export function isInternalSandpackPath(path: string): boolean {
  const p = path.startsWith('/') ? path : `/${path}`
  return INTERNAL_PATTERNS.some((re) => re.test(p) || re.test(path))
}

/** User-facing source files only (for Sandpack tabs / file lists). */
export function visibleUserFiles(files: Record<string, string>): string[] {
  return Object.keys(files)
    .filter((p) => !isInternalSandpackPath(p))
    .map((p) => (p.startsWith('/') ? p : `/${p}`))
}

export function loraApplicationUrl(appId: string | number, network: 'testnet' | 'mainnet' = 'testnet'): string {
  return `https://lora.algokit.io/${network}/application/${appId}`
}
