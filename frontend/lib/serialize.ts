/** Coerce algod uint fields (may be bigint in algosdk v3) to number for UI/postMessage. */
export function coerceUint(value: unknown): number {
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'number') return value
  const n = Number(value)
  if (Number.isNaN(n)) throw new TypeError(`coerceUint: cannot coerce ${typeof value} to number`)
  return n
}

/** Compare app IDs from algod (often bigint) with UI/app_id (number). */
export function sameAppId(a: unknown, b: unknown): boolean {
  return Number(a) === Number(b)
}

/** JSON.stringify safe for values that may contain bigint (e.g. ABI args). */
export function safeJsonStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? v.toString() : v))
}
