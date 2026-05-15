'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import algosdk from 'algosdk'
import { useAlgoCraftStore } from '@/lib/store'
import {
  BridgeRequest,
  BridgeResponse,
  CallMethodPayload,
  ReadStatePayload
} from '@/lib/bridge-protocol'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldAlert, Check, X, Loader2, ExternalLink, Wallet } from 'lucide-react'

export function BridgeHandler() {
  const { activeAddress, transactionSigner, algodClient } = useWallet()
  const { arc32Spec } = useAlgoCraftStore()

  // Confirmation Modal State
  const [pendingRequest, setPendingRequest] = useState<{ request: BridgeRequest, source: MessageEventSource } | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successTxId, setSuccessTxId] = useState<string | null>(null)

  // Message Listener
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data as BridgeRequest

      // Filter for AlgoCraft bridge requests
      if (!data || typeof data !== 'object' || !data.id || !data.type) return

      console.log(`[BridgeHandler] Received request: ${data.type}`, data.payload)

      switch (data.type) {
        case 'GET_ADDRESS':
          sendResponse(event.source!, data.id, { address: activeAddress })
          break

        case 'READ_STATE':
          handleReadState(event.source!, data)
          break

        case 'OPT_IN':
        case 'CALL_METHOD':
          setPendingRequest({ request: data, source: event.source! })
          break

        default:
          sendResponse(event.source!, data.id, null, `Unsupported request type: ${data.type}`)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [activeAddress])

  // Helpers
  const sendResponse = (source: MessageEventSource, id: string, result: any, error?: string) => {
    const response: BridgeResponse = {
      id,
      type: 'ALGOCRAFT_RESPONSE',
      result,
      error
    }
      ; (source as any).postMessage(response, '*')
  }

  const handleReadState = async (source: MessageEventSource, request: BridgeRequest) => {
    const { appId, address } = request.payload as ReadStatePayload
    try {
      const appInfo = await algodClient.getApplicationByID(Number(appId)).do()
      const globalStateRaw = (appInfo.params as any)['global-state'] || []

      // Decode global state
      const state: Record<string, any> = {}
      globalStateRaw.forEach((item: any) => {
        const key = Buffer.from(item.key, 'base64').toString()
        const val = item.value
        if (val.type === 1) {
          state[key] = val.bytes
        } else {
          state[key] = val.uint
        }
      })

      // Decode local state if address provided
      if (address) {
        try {
          const accountInfo = await algodClient.accountInformation(address).do()
          const appsLocalState = (accountInfo as any)['apps-local-state'] || []
          const appLocal = appsLocalState.find((a: any) => a.id === Number(appId))
          if (appLocal) {
            state['__opted_in__'] = true
            const localKV = appLocal['key-value'] || []
            localKV.forEach((item: any) => {
              const key = Buffer.from(item.key, 'base64').toString()
              const val = item.value
              state[`local:${key}`] = val.type === 1 ? val.bytes : val.uint
            })
          } else {
            state['__opted_in__'] = false
          }
        } catch {
          state['__opted_in__'] = false
        }
      }

      sendResponse(source, request.id, state)
    } catch (err: any) {
      sendResponse(source, request.id, null, err.message)
    }
  }

  // Helper: send an OptIn transaction, including the ABI selector if optInToApplication is an ABI method
  const sendOptInTransaction = async (
    appId: number,
    methods: any[],
    contractName: string,
    params: any
  ) => {
    const OPT_IN_METHOD_NAMES = ['optInToApplication', 'opt_in_to_application', 'optIn', 'opt_in']
    const optInMethodDef = methods.find((m: any) => OPT_IN_METHOD_NAMES.includes(m.name))

    let appArgs: Uint8Array[] | undefined = undefined
    if (optInMethodDef) {
      // Contract has optInToApplication as an ABI method — must include selector
      const contract = new algosdk.ABIContract({ name: contractName, methods })
      const method = contract.getMethodByName(optInMethodDef.name)
      appArgs = [method.getSelector()]
    }

    const txn = algosdk.makeApplicationOptInTxnFromObject({
      sender: activeAddress as string,
      appIndex: appId,
      suggestedParams: params,
      appArgs,
    })
    const signed = await transactionSigner([txn], [0])
    const resp = await algodClient.sendRawTransaction(signed[0]).do()
    const txId = (resp as any).txId || (resp as any).txid || ''
    if (!txId) throw new Error('OptIn transaction submitted but no TX ID returned')
    await algosdk.waitForConfirmation(algodClient, txId, 10)
    return txId
  }

  const executeCallMethod = async () => {
    if (!pendingRequest || !activeAddress || !transactionSigner) return

    setIsProcessing(true)
    setError(null)

    const { request, source } = pendingRequest
    const payload = request.payload as CallMethodPayload

    try {
      const params = await algodClient.getTransactionParams().do()

      // Always read fresh from store to avoid stale closure
      const freshSpec = useAlgoCraftStore.getState().arc32Spec
      if (!freshSpec) throw new Error('Contract specification is missing. Please redeploy.')

      const methods = freshSpec.contract?.methods || freshSpec.methods
      const contractName = freshSpec.contract?.name || freshSpec.name || 'Contract'
      if (!methods) throw new Error('No methods found in contract specification')

      console.log('[BridgeHandler] arc32Spec methods:', methods.map((m: any) => m.name))
      console.log('[BridgeHandler] Calling method:', payload.method, 'args:', payload.args)

      // Route all opt-in variants to a proper OptIn transaction
      const OPT_IN_NAMES = new Set(['__optIn__', 'opt_in', 'optIn', 'opt_in_to_application', 'optInToApplication'])
      if (OPT_IN_NAMES.has(payload.method)) {
        const txId = await sendOptInTransaction(Number(payload.appId), methods, contractName, params)
        setSuccessTxId(txId)
        sendResponse(source, request.id, { txId, success: true })
        setTimeout(() => handleCancel(), 3000)
        return
      }

      const contract = new algosdk.ABIContract({ name: contractName, methods })

      // Auto opt-in silently before method call if contract has local state
      const hasOptInMethod = methods.some((m: any) =>
        ['optInToApplication', 'opt_in_to_application', 'optIn', 'opt_in'].includes(m.name)
      )
      if (hasOptInMethod) {
        try {
          const accountInfo = await algodClient.accountInformation(activeAddress as string).do()
          const appsLocalState = (accountInfo as any)['apps-local-state'] || []
          const isOptedIn = appsLocalState.some((a: any) => a.id === Number(payload.appId))
          if (!isOptedIn) {
            await sendOptInTransaction(Number(payload.appId), methods, contractName, params)
          }
        } catch {
          // proceed anyway — contract will reject if truly needed
        }
      }

      const method = contract.getMethodByName(payload.method)

      // 1.5 Validate arguments against ABI
      if (payload.args.length !== method.args.length) {
        throw new Error(`Method '${method.name}' expects ${method.args.length} arguments, but received ${payload.args.length}.`)
      }

      payload.args.forEach((arg, i) => {
        const argSpec = method.args[i]
        const typeStr = argSpec.type.toString()
        if (typeStr === 'uint64') {
          if (typeof arg !== 'number' && isNaN(Number(arg))) {
            throw new Error(`Argument ${i} ('${argSpec.name}') of method '${method.name}' must be a number (uint64), but received '${typeof arg}'.`)
          }
        } else if (typeStr === 'string') {
          if (typeof arg !== 'string') {
            throw new Error(`Argument ${i} ('${argSpec.name}') of method '${method.name}' must be a string, but received '${typeof arg}'.`)
          }
        }
      })

      // 2. Prepare arguments
      const appArgs: Uint8Array[] = [method.getSelector()]

      payload.args.forEach((arg, i) => {
        const argSpec = method.args[i]
        const typeStr = argSpec.type.toString()
        if (typeStr === 'uint64' || typeStr.startsWith('uint')) {
          appArgs.push(algosdk.encodeUint64(BigInt(arg)))
        } else if (typeStr === 'bool') {
          appArgs.push(algosdk.encodeUint64(BigInt(arg ? 1 : 0)))
        } else if (typeStr === 'address' || typeStr === 'Account') {
          try {
            appArgs.push(algosdk.decodeAddress(String(arg)).publicKey)
          } catch {
            appArgs.push(new TextEncoder().encode(String(arg)))
          }
        } else if (typeStr === 'string') {
          const encoded = new TextEncoder().encode(String(arg))
          // ABI string encoding: 2-byte length prefix
          const lenBuf = new Uint8Array(2)
          new DataView(lenBuf.buffer).setUint16(0, encoded.length)
          const full = new Uint8Array(2 + encoded.length)
          full.set(lenBuf)
          full.set(encoded, 2)
          appArgs.push(full)
        } else if (typeStr === 'bytes' || typeStr.startsWith('byte[')) {
          appArgs.push(new TextEncoder().encode(String(arg)))
        } else {
          appArgs.push(new TextEncoder().encode(String(arg)))
        }
      })

      // 3. Build Transaction
      const txn = algosdk.makeApplicationCallTxnFromObject({
        sender: activeAddress as string,
        appIndex: Number(payload.appId),
        onComplete: algosdk.OnApplicationComplete.NoOpOC,
        appArgs,
        suggestedParams: params,
      })

      // 4. Handle Payment atomic group — payment MUST come before app call (index 0)
      let txns = [txn]
      if (payload.payment) {
        const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          sender: activeAddress as string,
          receiver: algosdk.getApplicationAddress(Number(payload.appId)),
          amount: payload.payment.amount,
          suggestedParams: params,
        })
        // payment at index 0, app call at index 1 — matches gtxn.PaymentTxn(Uint64(0))
        txns = [payTxn, txn]
        algosdk.assignGroupID(txns)
      }

      // 5. Sign and Submit
      // Wrap in timeout because Pera/Defly wallets sometimes silently fail during simulation, hanging the promise
      const signPromise = transactionSigner(txns, txns.map((_, i) => i))
      const signed = await Promise.race([
        signPromise,
        new Promise<Uint8Array[]>((_, reject) =>
          setTimeout(() => reject(new Error("Wallet took too long to respond. The transaction may have failed simulation in your wallet app, or connection was dropped.")), 45000)
        )
      ])

      // Concatenate signed transactions safely for all algosdk versions
      const totalLength = signed.reduce((acc, curr) => acc + curr.length, 0)
      const signedBytes = new Uint8Array(totalLength)
      let offset = 0
      for (const b of signed) {
        signedBytes.set(b, offset)
        offset += b.length
      }

      const response = await algodClient.sendRawTransaction(signedBytes).do()
      const txId = (response as any).txId || (response as any).txid || (response as any)['txId'] || (response as any)['txid'] || ''

      if (!txId) {
        throw new Error("Transaction was submitted but no Transaction ID was returned by the node.")
      }

      await algosdk.waitForConfirmation(algodClient, txId, 10)

      setSuccessTxId(txId)
      sendResponse(source, request.id, { txId, success: true })

      // Auto-close after success
      setTimeout(() => {
        handleCancel()
      }, 3000)

    } catch (err: any) {
      console.error("[BridgeHandler] Call failed:", err)
      setError(err.message || "Transaction failed")
      sendResponse(source, request.id, null, err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCancel = () => {
    if (pendingRequest && !successTxId) {
      sendResponse(pendingRequest.source, pendingRequest.request.id, null, "User cancelled transaction")
    }
    setPendingRequest(null)
    setIsProcessing(false)
    setError(null)
    setSuccessTxId(null)
  }

  if (!pendingRequest) return null

  const callPayload = pendingRequest.request.payload as CallMethodPayload

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-surface shadow-2xl"
      >
        <div className="relative p-8 text-center">
          {/* Background Highlight */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-nb-gold/10 rounded-full blur-3xl pointer-events-none" />

          {successTxId ? (
            <div className="space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-nb-green/20 text-nb-green shadow-lg shadow-nb-green/10">
                <Check className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-foreground">Transaction Confirmed</h3>
              <p className="text-xs text-muted font-bold px-4">
                Method <span className="text-nb-gold">{callPayload.method}</span> executed successfully on-chain.
              </p>
              <div className="pt-4 flex flex-col gap-2">
                <a
                  href={`https://lora.algokit.io/testnet/transaction/${successTxId}`}
                  target="_blank"
                  className="flex items-center justify-center gap-2 rounded-xl bg-nb-green/10 px-4 py-3 text-xs font-bold text-nb-green border border-nb-green/20"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View on Explorer
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-nb-gold/10 text-nb-gold shadow-lg shadow-nb-gold/10">
                <ShieldAlert className="h-8 w-8" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-black uppercase tracking-tight text-foreground">
                  {callPayload.method === '__optIn__' ? 'Opt In to App' : 'Authorize Action'}
                </h3>
                <p className="text-xs text-muted font-bold">
                  {callPayload.method === '__optIn__'
                    ? 'This will opt your wallet into the smart contract, enabling local state storage.'
                    : <>The DApp is requesting to call <span className="text-nb-gold">@{callPayload.method}</span>.</>}
                </p>
              </div>

              <div className="rounded-2xl bg-surface-2 p-4 border border-white/5 space-y-3">
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-muted/60">
                  <span>Method</span>
                  <span className="text-nb-gold">{callPayload.method}</span>
                </div>
                {callPayload.args.length > 0 && (
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-muted/60">
                    <span>Arguments</span>
                    <span className="text-foreground">{JSON.stringify(callPayload.args)}</span>
                  </div>
                )}
                {callPayload.payment && (
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-nb-red">
                    <span>Payment</span>
                    <span>{callPayload.payment.amount / 1_000_000} ALGO</span>
                  </div>
                )}
              </div>

              {error && (
                <div className="rounded-xl bg-nb-red/10 border border-nb-red/20 p-3 text-[10px] text-nb-red font-bold">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleCancel}
                  disabled={isProcessing}
                  className="flex items-center justify-center gap-2 rounded-xl bg-surface-2 px-4 py-3 text-xs font-bold text-foreground transition-all hover:bg-white/5"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
                <button
                  onClick={executeCallMethod}
                  disabled={isProcessing}
                  className="flex items-center justify-center gap-2 rounded-xl bg-nb-gold px-4 py-3 text-xs font-bold text-background transition-all hover:opacity-90 shadow-lg shadow-nb-gold/20"
                >
                  {isProcessing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Wallet className="w-3.5 h-3.5" />
                  )}
                  {isProcessing ? 'Confirming...' : 'Sign & Submit'}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
