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
import { getMethodOnComplete } from '@/lib/abi-tx'
import { safeJsonStringify, sameAppId } from '@/lib/serialize'
import { readApplicationState } from '@/lib/algorand-state'

const OPT_IN_METHOD_NAMES = new Set([
  '__optIn__',
  'opt_in',
  'optIn',
  'opt_in_to_application',
  'optInToApplication',
])

/** ARC-4 `pay` args are satisfied by a grouped payment txn, not payload.args */
function isPayAbiType(typeStr: string): boolean {
  const t = typeStr.toLowerCase()
  return t === 'pay' || t === 'payment'
}
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

  // Notify Sandpack iframe when parent wallet connects / changes (fixes opt-in UI after reload)
  // Fix: Use multiple retry timings + iframe load event to guarantee delivery
  useEffect(() => {
    const notify = () => {
      document.querySelectorAll('iframe').forEach((iframe) => {
        iframe.contentWindow?.postMessage(
          {
            type: 'ALGOCRAFT_EVENT',
            event: 'WALLET_CHANGED',
            payload: { address: activeAddress ?? '' },
          },
          '*'
        )
      })
    }

    // Immediate + escalating retries to cover Sandpack's 2-5s init time
    notify()
    const t1 = setTimeout(notify, 500)
    const t2 = setTimeout(notify, 1500)
    const t3 = setTimeout(notify, 3000)
    const t4 = setTimeout(notify, 5000)

    // Also listen for iframe load events (covers fresh/hot reload)
    const handleLoad = () => { setTimeout(notify, 300) }
    document.querySelectorAll('iframe').forEach((iframe) => {
      iframe.addEventListener('load', handleLoad)
    })

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
      document.querySelectorAll('iframe').forEach((iframe) => {
        iframe.removeEventListener('load', handleLoad)
      })
    }
  }, [activeAddress])

  const isAccountOptedIn = async (appId: number, address: string) => {
    const accountInfo = await algodClient.accountInformation(address).do()
    const appsLocalState = (accountInfo as any)['apps-local-state'] || []
    return appsLocalState.some((a: any) => sameAppId(a.id, appId))
  }

  // Message Listener
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data as BridgeRequest

      // Filter for AlgoCraft bridge requests
      if (!data || typeof data !== 'object' || !data.id || !data.type) return
      if (!event.source) return

      console.log(`[BridgeHandler] Received request: ${data.type}`, data.payload)

      // On first message from iframe, ensure it has our wallet state
      if (data.type === 'GET_ADDRESS' || data.type === 'READ_STATE') {
        // Also send a WALLET_CHANGED event (belt-and-suspenders for timing issues)
        try {
          (event.source as any).postMessage({
            type: 'ALGOCRAFT_EVENT',
            event: 'WALLET_CHANGED',
            payload: { address: activeAddress ?? '' },
          }, '*')
        } catch {}
      }

      switch (data.type) {
        case 'GET_ADDRESS': {
          const addr =
            activeAddress || useAlgoCraftStore.getState().walletAddress || null
          sendResponse(event.source, data.id, { address: addr })
          break
        }

        case 'READ_STATE':
          handleReadState(event.source, data)
          break

        case 'OPT_IN':
        case 'CALL_METHOD': {
          const payload = data.payload as CallMethodPayload
          const wallet =
            activeAddress || useAlgoCraftStore.getState().walletAddress || null
          if (OPT_IN_METHOD_NAMES.has(payload?.method) && wallet) {
            void (async () => {
              try {
                const already = await isAccountOptedIn(
                  Number(payload.appId),
                  wallet
                )
                if (already) {
                  sendResponse(event.source!, data.id, {
                    success: true,
                    alreadyOptedIn: true,
                  })
                  return
                }
              } catch {
                /* show sign modal */
              }
              setPendingRequest({ request: data, source: event.source! })
            })()
            break
          }
          setPendingRequest({ request: data, source: event.source! })
          break
        }

        default:
          if (data.type === 'SIGN_X402_PAYMENT') {
            handleSignX402Payment(event.source, data)
            break
          }
          if (data.type === 'X402_FETCH') {
            handleX402Fetch(event.source, data)
            break
          }
          sendResponse(event.source, data.id, null, `Unsupported request type: ${data.type}`)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [activeAddress, transactionSigner, algodClient])

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
    const { appId, address: payloadAddress } = request.payload as ReadStatePayload
    const address =
      payloadAddress ||
      activeAddress ||
      useAlgoCraftStore.getState().walletAddress ||
      undefined
    try {
      const arc32Spec = useAlgoCraftStore.getState().arc32Spec
      const state = await readApplicationState(
        algodClient,
        appId,
        address || null,
        arc32Spec
      )
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
    await Promise.race([
      algosdk.waitForConfirmation(algodClient, txId, 10),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Transaction confirmation timed out after 30 seconds. Check the explorer.')), 30000))
    ])
    return txId
  }

  /**
   * Handle x402 payment signing.
   * 
   * The x402 protocol requires the client to sign a payment transaction
   * and return it as a base64-encoded proof that gets sent as an X-PAYMENT header.
   * 
   * This uses the @x402/avm client scheme pattern:
   * 1. Parse payment requirements from the 402 response
   * 2. Build an Algorand payment/ASA transfer transaction
   * 3. Sign it with the connected wallet
   * 4. Return the signed bytes as base64 (the "payment proof")
   */
  const handleSignX402Payment = async (source: MessageEventSource, request: BridgeRequest) => {
    const { paymentRequirements, resourceUrl } = request.payload || {}

    if (!activeAddress || !transactionSigner) {
      sendResponse(source, request.id, null, 'Wallet not connected — cannot sign x402 payment')
      return
    }

    if (!paymentRequirements) {
      sendResponse(source, request.id, null, 'Missing paymentRequirements in SIGN_X402_PAYMENT request')
      return
    }

    try {
      const params = await algodClient.getTransactionParams().do()

      // x402 payment requirements contain: payTo, amount (atomic units), asset (optional ASA ID)
      const payTo = paymentRequirements.payTo
      const amount = Number(paymentRequirements.maxAmountRequired || paymentRequirements.amount || 0)
      const asset = paymentRequirements.extra?.asset || paymentRequirements.asset

      if (!payTo || amount <= 0) {
        sendResponse(source, request.id, null, 'Invalid payment requirements: missing payTo or amount')
        return
      }

      let txn: algosdk.Transaction

      if (asset) {
        // ASA transfer (USDC)
        txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          sender: activeAddress as string,
          receiver: payTo,
          amount: amount,
          assetIndex: Number(asset),
          suggestedParams: params,
        })
      } else {
        // Native ALGO payment
        txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          sender: activeAddress as string,
          receiver: payTo,
          amount: amount,
          suggestedParams: params,
        })
      }

      // Sign the transaction
      const signed = await transactionSigner([txn], [0])
      const signedBytes = signed[0]

      // Return the signed transaction as base64 — this becomes the X-PAYMENT header value
      const base64Proof = Buffer.from(signedBytes).toString('base64')

      sendResponse(source, request.id, {
        signedPayment: base64Proof,
        sender: activeAddress,
        receiver: payTo,
        amount: amount,
        asset: asset || null,
        txnBytes: base64Proof, // alias for compatibility
      })
    } catch (err: any) {
      console.error('[BridgeHandler] x402 payment signing failed:', err)
      sendResponse(source, request.id, null, `x402 payment signing failed: ${err.message}`)
    }
  }

  /**
   * Handle the FULL x402 round trip by calling the backend x402-proxy endpoint.
   * The backend uses @x402/fetch + a funded hot wallet for spec-compliant payment.
   */
  const handleX402Fetch = async (source: MessageEventSource, request: BridgeRequest) => {
    const { url, options } = request.payload || {}

    if (!url) {
      sendResponse(source, request.id, null, 'Missing url in X402_FETCH request')
      return
    }

    try {
      console.log('[BridgeHandler] x402 proxy request ->', url)

      const backendUrl = (window.location.origin.includes('localhost')
        ? 'http://localhost:8000'
        : '') + '/api/v1/x402-proxy'

      const resp = await fetch(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, method: options?.method || 'GET' }),
      })

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '')
        sendResponse(source, request.id, null, `x402 proxy error (${resp.status}): ${errText.slice(0, 300)}`)
        return
      }

      const result = await resp.json()

      if (result.success) {
        sendResponse(source, request.id, {
          data: result.data,
          paid: true,
          receipt: result.receipt || { protocol: 'x402', status: 'settled' },
          mode: 'x402-http',
        })
      } else {
        sendResponse(source, request.id, null, result.error || result.detail || 'x402 proxy returned failure')
      }
    } catch (err: any) {
      console.error('[BridgeHandler] x402 proxy call failed:', err)
      sendResponse(source, request.id, null, `x402 proxy failed: ${err.message}`)
    }
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
        const appIdNum = Number(payload.appId)
        const alreadyIn = await isAccountOptedIn(appIdNum, activeAddress as string)
        if (alreadyIn) {
          sendResponse(source, request.id, { success: true, alreadyOptedIn: true })
          setTimeout(() => handleCancel(), 1500)
          return
        }
        const txId = await sendOptInTransaction(appIdNum, methods, contractName, params)
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
          const isOptedIn = appsLocalState.some((a: any) => sameAppId(a.id, payload.appId))
          if (!isOptedIn) {
            await sendOptInTransaction(Number(payload.appId), methods, contractName, params)
          }
        } catch {
          // proceed anyway — contract will reject if truly needed
        }
      }

      const method = contract.getMethodByName(payload.method)

      // ─── Use AtomicTransactionComposer for proper ARC-4 ABI encoding ─────
      // ATC handles Account/Asset/Application reference types correctly
      // (puts them in foreign arrays, encodes indices in app args).
      // It also handles transaction references (pay, axfer) as grouped txns.

      const atc = new algosdk.AtomicTransactionComposer()

      // Build the method call args in the order the ABI method expects them.
      // For each arg: if it's a transaction type (pay), provide a TransactionWithSigner.
      // For other types, provide the raw value and ATC encodes it correctly.
      const methodArgs: any[] = []
      let userArgIdx = 0

      for (const argSpec of method.args) {
        const typeStr = argSpec.type.toString()

        if (isPayAbiType(typeStr)) {
          // Transaction reference (pay) — build a payment transaction
          const payAmount = payload.payment?.amount || 0
          if (payAmount <= 0) {
            throw new Error(`Method '${method.name}' requires a payment amount.`)
          }
          const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            sender: activeAddress as string,
            receiver: payload.payment?.receiver || algosdk.getApplicationAddress(Number(payload.appId)),
            amount: payAmount,
            suggestedParams: params,
          })
          methodArgs.push({
            txn: payTxn,
            signer: transactionSigner,
          })
        } else {
          // Regular ABI arg — use the value from payload.args
          const arg = payload.args[userArgIdx]
          userArgIdx++

          if (typeStr === 'uint64' || typeStr.startsWith('uint')) {
            methodArgs.push(BigInt(Number(arg)))
          } else if (typeStr === 'bool') {
            methodArgs.push(Boolean(arg))
          } else if (typeStr === 'account' || typeStr === 'address') {
            // ATC handles account references: pass the address string
            methodArgs.push(String(arg))
          } else if (typeStr === 'asset') {
            methodArgs.push(Number(arg))
          } else if (typeStr === 'application') {
            methodArgs.push(Number(arg))
          } else if (typeStr === 'string') {
            methodArgs.push(String(arg))
          } else if (typeStr === 'bytes' || typeStr.startsWith('byte')) {
            methodArgs.push(new Uint8Array(new TextEncoder().encode(String(arg))))
          } else {
            // Default: pass as-is (ATC will attempt encoding)
            methodArgs.push(arg)
          }
        }
      }

      // Determine onComplete
      let onComplete = getMethodOnComplete(payload.method, freshSpec)
      if (onComplete === algosdk.OnApplicationComplete.OptInOC) {
        try {
          const accountInfo = await algodClient.accountInformation(activeAddress as string).do()
          const appsLocalState = (accountInfo as any)['apps-local-state'] || []
          const alreadyOpted = appsLocalState.some((a: any) => sameAppId(a.id, payload.appId))
          if (alreadyOpted) {
            onComplete = algosdk.OnApplicationComplete.NoOpOC
          }
        } catch {
          // keep OptIn
        }
      }

      // Box references (if contract uses box storage)
      const contractSpecForBox = useAlgoCraftStore.getState().contractSpec as any
      const arc32ForBoxCheck = useAlgoCraftStore.getState().arc32Spec
      const boxCapFlag = contractSpecForBox?.capabilities?.uses_box_storage
      const specStr = JSON.stringify(arc32ForBoxCheck || {}).toLowerCase()
      const usesBoxes = boxCapFlag === true || (
        boxCapFlag === undefined && (specStr.includes('box') || specStr.includes('boxmap'))
      )

      let boxRefs: any[] | undefined = undefined
      if (usesBoxes) {
        const senderPubKey = algosdk.decodeAddress(activeAddress as string).publicKey
        boxRefs = []
        const commonPrefixes = ['', 'b', 'c', 'counter', 'v', 'd', 'u', 'p']
        for (const prefix of commonPrefixes) {
          const prefixBytes = new TextEncoder().encode(prefix)
          const combined = new Uint8Array(prefixBytes.length + senderPubKey.length)
          combined.set(prefixBytes, 0)
          combined.set(senderPubKey, prefixBytes.length)
          boxRefs.push({ appIndex: 0, name: combined })
          if (boxRefs.length >= 7) break
        }
        boxRefs.push({ appIndex: 0, name: new Uint8Array(0) })
      }

      // Add method call to ATC
      atc.addMethodCall({
        appID: Number(payload.appId),
        method,
        methodArgs,
        sender: activeAddress as string,
        signer: transactionSigner,
        suggestedParams: { ...params, fee: params.fee || 1000, flatFee: true },
        onComplete,
        boxes: boxRefs,
      } as any)

      // Execute via ATC — handles grouping, signing, and submission
      console.log('[BridgeHandler] Executing via ATC:', payload.method, methodArgs.length, 'args')
      const atcResult = await atc.execute(algodClient, 10)
      const txId = atcResult.txIDs[atcResult.txIDs.length - 1] || ''

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
                    <span className="text-foreground">{safeJsonStringify(callPayload.args)}</span>
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
