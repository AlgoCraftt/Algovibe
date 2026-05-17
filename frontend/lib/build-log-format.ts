/** Turn raw compiler / pipeline strings into short, readable build-log lines. */

export function summarizeCompilerError(raw: string): string {
  const text = raw.replace(/\\n/g, '\n')

  const located = text.match(
    /([^\s:]+\.(?:algo\.ts|ts|py)):(\d+):(\d+)\s+error:\s*`?([^`\n]+)`?/i,
  )
  if (located) {
    const [, file, line, , msg] = located
    const short = msg.trim().replace(/\s+/g, ' ')
    return `${file.split('/').pop()} line ${line}: ${short}`
  }

  const jsonErr = text.match(/"error"\s*:\s*"([^"]+)"/)
  if (jsonErr) {
    const inner = jsonErr[1]
    if (inner.length < 200) return inner.replace(/\\n/g, ' · ')
    return inner.slice(0, 180) + '…'
  }

  if (text.includes('Process exited with code')) {
    const after = text.split('Process exited with code 1').pop() || text
    const firstLine = after.split('\n').map((l) => l.trim()).find(Boolean)
    if (firstLine) return firstLine.slice(0, 200)
  }

  return text.length > 220 ? text.slice(0, 220) + '…' : text
}

export function formatBuildLog(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed

  if (trimmed.startsWith('⚠️')) return trimmed

  const retry = trimmed.match(
    /Compilation error \(retry (\d+)\/(\d+)\):\s*(.+)/is,
  )
  if (retry) {
    const [, n, max, err] = retry
    return `Compile retry ${n}/${max} — ${summarizeCompilerError(err)}`
  }

  if (
    trimmed.includes('Compiler server returned') ||
    trimmed.includes('Process exited with code') ||
    trimmed.includes('error:')
  ) {
    return `Compiler: ${summarizeCompilerError(trimmed)}`
  }

  return trimmed
}

export function statusHeadline(status: string): string {
  switch (status) {
    case 'analyzing':
      return 'Understanding your DApp idea'
    case 'retrieving_docs':
      return 'Loading Algorand documentation'
    case 'generating_contract':
      return 'Writing smart contract logic'
    case 'compiling':
      return 'Compiling to AVM bytecode'
    case 'deploying':
      return 'Preparing testnet deployment'
    case 'awaiting_signature':
      return 'Sign in your wallet to deploy'
    case 'generating_react':
      return 'Building React preview & hooks'
    case 'verifying_paths':
      return 'Tracing UI → contract paths'
    case 'simulating':
      return 'Simulating on testnet (happy path)'
    case 'fixing_frontend':
      return 'Applying your changes'
    case 'complete':
      return 'Your DApp is ready'
    case 'error':
      return 'Build encountered an issue'
    default:
      return 'Building your Algorand DApp'
  }
}
