/** Fix duplicate parameter names in generated useContract.ts (e.g. payment, payment). */
export function sanitizeUseContractTs(code: string): string {
  return code.replace(/async\s*\(([^)]*)\)\s*=>/g, (_match, params: string) => {
    const parts = params.split(',').map((p: string) => p.trim()).filter(Boolean)
    const seen = new Set<string>()
    const unique: string[] = []

    for (const part of parts) {
      const nameMatch = part.match(/^(\w+)\s*:/)
      if (!nameMatch) {
        unique.push(part)
        continue
      }
      let name = nameMatch[1]
      if (seen.has(name)) {
        if (name === 'payment') {
          unique.push(part.replace(/^payment\s*:/, 'amountMicroAlgos:'))
          seen.add('amountMicroAlgos')
        } else {
          let suffix = 2
          let newName = `${name}${suffix}`
          while (seen.has(newName)) {
            suffix += 1
            newName = `${name}${suffix}`
          }
          unique.push(part.replace(/^\w+\s*:/, `${newName}:`))
          seen.add(newName)
        }
        continue
      }
      seen.add(name)
      unique.push(part)
    }

    return `async (${unique.join(', ')}) =>`
  })
}

export function patchGeneratedFrontendFiles(files: Record<string, string>): Record<string, string> {
  const out = { ...files }
  for (const [path, content] of Object.entries(files)) {
    if (path.includes('useContract.ts')) {
      const fixed = sanitizeUseContractTs(content)
      if (fixed !== content) {
        out[path] = fixed
        const alt = path.startsWith('/') ? path.slice(1) : `/${path}`
        out[alt] = fixed
      }
    }
  }
  return out
}
