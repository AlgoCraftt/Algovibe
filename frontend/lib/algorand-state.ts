/**
 * Shared algod v2/v3 state decoding for preview bridge + export templates.
 */
import algosdk from 'algosdk'
import { coerceUint, sameAppId } from './serialize'

export type Arc32Spec = {
  schema?: {
    global?: { declared?: Record<string, { key?: string; type?: string }> }
    local?: { declared?: Record<string, { key?: string; type?: string }> }
  }
  contract?: { methods?: unknown[] }
  methods?: unknown[]
}

/** Global state KV from getApplicationByID (algosdk v2 snake_case + v3 variants). */
export function getGlobalStateRaw(appInfo: unknown): unknown[] {
  const params = (appInfo as { params?: Record<string, unknown> })?.params ?? appInfo
  const p = params as Record<string, unknown>
  const raw =
    p['global-state'] ??
    p.globalState ??
    p['global_state'] ??
    (appInfo as Record<string, unknown>)['global-state']
  return Array.isArray(raw) ? raw : []
}

/** apps-local-state from accountInformation. */
export function getAppsLocalStateRaw(accountInfo: unknown): Array<{ id: unknown; 'key-value'?: unknown[]; keyValue?: unknown[] }> {
  const a = accountInfo as Record<string, unknown>
  const raw = a['apps-local-state'] ?? a.appsLocalState ?? a['apps_local_state']
  return Array.isArray(raw) ? (raw as Array<{ id: unknown; 'key-value'?: unknown[]; keyValue?: unknown[] }>) : []
}

function decodeKvItem(item: { key: string; value: { type: number; bytes?: string; uint?: unknown } }): [string, unknown] {
  const key = Buffer.from(item.key, 'base64').toString()
  const val = item.value
  if (val.type === 1 && val.bytes) {
    const raw = Buffer.from(val.bytes, 'base64')
    if (raw.length === 32) {
      try {
        return [key, algosdk.encodeAddress(new Uint8Array(raw))]
      } catch {
        return [key, raw.toString('utf8')]
      }
    }
    return [key, raw.length <= 8 ? coerceUint(raw) : raw.toString('utf8')]
  }
  return [key, coerceUint(val.uint)]
}

/** Decode global or local key-value array into a flat record (on-chain keys). */
export function decodeKeyValueList(kv: unknown[]): Record<string, unknown> {
  const state: Record<string, unknown> = {}
  for (const item of kv) {
    const row = item as { key: string; value: { type: number; bytes?: string; uint?: unknown } }
    if (!row?.key || !row?.value) continue
    const [k, v] = decodeKvItem(row)
    state[k] = v
  }
  return state
}

/** Add friendly aliases from ARC-32 schema.declared (fieldName -> on-chain key). */
export function applyArc32Aliases(state: Record<string, unknown>, arc32Spec: Arc32Spec | null | undefined): void {
  if (!arc32Spec?.schema) return
  const addDeclared = (declared?: Record<string, { key?: string }>) => {
    if (!declared) return
    for (const [fieldName, meta] of Object.entries(declared)) {
      const onChainKey = meta?.key
      if (!onChainKey) continue
      if (state[onChainKey] !== undefined && state[fieldName] === undefined) {
        state[fieldName] = state[onChainKey]
      }
      if (state[fieldName] !== undefined && state[onChainKey] === undefined) {
        state[onChainKey] = state[fieldName]
      }
    }
  }
  addDeclared(arc32Spec.schema.global?.declared)
  addDeclared(arc32Spec.schema.local?.declared)
}

export type ReadAppStateResult = Record<string, unknown> & {
  __opted_in__?: boolean
}

/**
 * Read global state always; local + __opted_in__ only when address is provided.
 * On local read failure, __opted_in__ is omitted (not forced false).
 */
export async function readApplicationState(
  algodClient: algosdk.Algodv2,
  appId: number | string,
  address?: string | null,
  arc32Spec?: Arc32Spec | null
): Promise<ReadAppStateResult> {
  const appInfo = await algodClient.getApplicationByID(Number(appId)).do()
  const state = decodeKeyValueList(getGlobalStateRaw(appInfo)) as ReadAppStateResult

  if (address) {
    try {
      const accountInfo = await algodClient.accountInformation(address).do()
      const apps = getAppsLocalStateRaw(accountInfo)
      const appLocal = apps.find((a) => sameAppId(a.id, appId))
      if (appLocal) {
        state.__opted_in__ = true
        const localKv = appLocal['key-value'] ?? appLocal.keyValue ?? []
        Object.assign(state, decodeKeyValueList(localKv as unknown[]))
      } else {
        state.__opted_in__ = false
      }
    } catch {
      // Rate limit / network — do not flip opted-in to false
    }
  }

  applyArc32Aliases(state, arc32Spec)
  return state
}
