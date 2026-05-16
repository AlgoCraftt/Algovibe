import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const src = fs.readFileSync(path.join(__dirname, '../lib/export-algorand-state.ts'), 'utf8')
const out = `/** Auto-generated from export-algorand-state.ts — do not hand-edit */\nexport const EXPORT_ALGORAND_STATE_TS = ${JSON.stringify(src)}\n`
fs.writeFileSync(path.join(__dirname, '../lib/export-algorand-state-string.ts'), out)
console.log('Wrote export-algorand-state-string.ts', out.length, 'bytes')
