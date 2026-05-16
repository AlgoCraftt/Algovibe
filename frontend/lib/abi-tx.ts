import algosdk from 'algosdk'

/** Build ARC-32 hint key, e.g. cast_vote(string)void */
export function arc32HintKey(methodDef: {
  name: string
  args?: { type: string }[]
  returns?: { type: string }
}): string {
  const argsSig = (methodDef.args || []).map((a) => a.type).join(',')
  const retSig = methodDef.returns?.type ?? 'void'
  return `${methodDef.name}(${argsSig})${retSig}`
}

/** Resolve OnApplicationComplete from ARC-32 hints for a method name. */
export function getMethodOnComplete(
  methodName: string,
  arc32Spec: Record<string, unknown> | null | undefined
): algosdk.OnApplicationComplete {
  if (!arc32Spec) return algosdk.OnApplicationComplete.NoOpOC

  const methods =
    (arc32Spec as { contract?: { methods?: unknown[] } }).contract?.methods ||
    (arc32Spec as { methods?: unknown[] }).methods ||
    []

  const methodDef = (methods as { name: string; args?: { type: string }[]; returns?: { type: string } }[]).find(
    (m) => m.name === methodName
  )
  if (!methodDef) return algosdk.OnApplicationComplete.NoOpOC

  const hints = (arc32Spec as { hints?: Record<string, { call_config?: Record<string, string> }> }).hints || {}
  const hint = hints[arc32HintKey(methodDef)]
  const callConfig = hint?.call_config

  // OptIn-only ABI methods (Puya allowActions: 'OptIn') — use only before local state exists
  if (callConfig?.opt_in === 'CALL') {
    return algosdk.OnApplicationComplete.OptInOC
  }
  return algosdk.OnApplicationComplete.NoOpOC
}
