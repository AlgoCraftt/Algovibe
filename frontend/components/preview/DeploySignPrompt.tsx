'use client'

import { useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import algosdk from 'algosdk'
import { useAlgoCraftStore } from '@/lib/store'
import { PenLine, Loader2, AlertCircle, Wallet, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'

export function DeploySignPrompt({ variant = 'modal' }: { variant?: 'modal' | 'inline' }) {
  const isInline = variant === 'inline'
  const pendingSignature = useAlgoCraftStore((s) => s.pendingSignature)
  const completeDeployment = useAlgoCraftStore((s) => s.completeDeployment)
  const setError = useAlgoCraftStore((s) => s.setError)

  const { activeAddress, transactionSigner, algodClient } = useWallet()

  const [signing, setSigning] = useState(false)
  const [signError, setSignError] = useState<string | null>(null)

  if (!pendingSignature) return null

  if (!activeAddress) {
    return (
      <motion.div
        className={
          isInline
            ? 'rounded-xl border border-nb-gold/30 bg-nb-gold/5 p-4'
            : 'rounded-2xl border border-nb-gold/30 bg-nb-gold/5 p-6 backdrop-blur-xl shadow-2xl shadow-nb-gold/10 overflow-hidden relative'
        }
      >
        <div className="flex flex-col items-center text-center">
          <Wallet className="h-8 w-8 text-nb-gold mb-3" />
          <h4 className="text-base font-black uppercase tracking-tight mb-1">Wallet disconnected</h4>
          <p className="text-sm text-muted/80 max-w-md">
            Connect your Algorand wallet to deploy the contract.
          </p>
        </div>
      </motion.div>
    )
  }

  const handleSign = async () => {
    setSigning(true)
    setSignError(null)

    try {
      if (!pendingSignature.approval_teal || !pendingSignature.clear_teal) {
        throw new Error('Contract code not provided by backend')
      }

      const appComp = await algodClient.compile(pendingSignature.approval_teal).do()
      const clearComp = await algodClient.compile(pendingSignature.clear_teal).do()

      const appBytes = Uint8Array.from(atob(appComp.result), (c) => c.charCodeAt(0))
      const clearBytes = Uint8Array.from(atob(clearComp.result), (c) => c.charCodeAt(0))

      const params = await algodClient.getTransactionParams().do()

      let gi = 0,
        gb = 0,
        li = 0,
        lb = 0
      if (pendingSignature.arc32_spec?.state) {
        const s = pendingSignature.arc32_spec.state
        gi = s.global?.num_uints || 0
        gb = s.global?.num_byte_slices || 0
        li = s.local?.num_uints || 0
        lb = s.local?.num_byte_slices || 0
      }

      let appArgs: Uint8Array[] = []
      const spec = pendingSignature.arc32_spec
      if (spec) {
        const methods = spec.contract?.methods || spec.methods
        const contractName = spec.contract?.name || spec.name || 'Contract'
        if (methods && Array.isArray(methods)) {
          try {
            const contract = new algosdk.ABIContract({ name: contractName, methods })
            const createMethodDef = methods.find(
              (m: { name: string; actions?: { create?: boolean } }) =>
                m.actions?.create || m.name === 'createApplication' || m.name === 'create'
            )
            if (createMethodDef) {
              const method = contract.getMethodByName(createMethodDef.name)
              appArgs.push(method.getSelector())
            }
          } catch (err) {
            console.warn('[DeploySignPrompt] Could not parse ABI for create selector', err)
          }
        }
      }

      const txn = algosdk.makeApplicationCreateTxnFromObject({
        sender: activeAddress,
        suggestedParams: params,
        onComplete: algosdk.OnApplicationComplete.NoOpOC,
        approvalProgram: appBytes,
        clearProgram: clearBytes,
        numGlobalInts: gi,
        numGlobalByteSlices: gb,
        numLocalInts: li,
        numLocalByteSlices: lb,
        appArgs: appArgs.length > 0 ? appArgs : undefined,
      })

      const signedTransactions = await transactionSigner([txn], [0])
      const signedTxn = signedTransactions[0]
      const response = await algodClient.sendRawTransaction(signedTxn).do()
      const txId = (response as { txId?: string; txid?: string }).txId || (response as { txid?: string }).txid

      if (!txId) throw new Error('Failed to submit transaction: No ID returned')

      const confirmation = await algosdk.waitForConfirmation(algodClient, txId, 10)
      const confirmed = confirmation as unknown as {
        'application-index'?: number
        applicationIndex?: number
      }
      const appId = confirmed['application-index'] ?? confirmed.applicationIndex

      if (!appId) throw new Error('Transaction succeeded but Application ID was not found')

      await completeDeployment(pendingSignature.buildId, appId.toString())
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Signing failed'
      setSignError(msg)
      setError(msg)
    } finally {
      setSigning(false)
    }
  }

  return (
    <motion.div
      className={
        isInline
          ? 'flex flex-col lg:flex-row lg:items-center gap-4 w-full'
          : 'rounded-2xl border border-nb-gold/40 bg-surface p-6 backdrop-blur-xl shadow-2xl shadow-nb-gold/10 relative overflow-hidden'
      }
    >
      {!isInline && (
        <motion.div className="absolute top-0 right-0 w-32 h-32 bg-nb-gold/10 rounded-full blur-[60px] pointer-events-none" />
      )}

      <div className={isInline ? 'flex-1 min-w-0' : 'relative z-10'}>
        <div className={`flex items-center gap-3 ${isInline ? 'mb-2' : 'mb-6'}`}>
          <div
            className={`${isInline ? 'w-10 h-10' : 'w-12 h-12'} rounded-xl bg-nb-gold/10 border border-nb-gold/30 flex items-center justify-center shrink-0`}
          >
            <PenLine className={`${isInline ? 'h-5 w-5' : 'h-6 w-6'} text-nb-gold`} />
          </div>
          <div className="min-w-0">
            <h4
              className={`${isInline ? 'text-base' : 'text-lg'} font-black uppercase tracking-tight text-foreground`}
            >
              Deploy contract to testnet
            </h4>
            <p className="text-[10px] font-bold text-nb-green/80 uppercase tracking-widest mt-0.5">
              {isInline ? 'Preview code below, then sign' : 'Secure Algorand node ready'}
            </p>
          </div>
        </div>

        {!isInline && (
          <p className="text-sm text-muted/90 leading-relaxed mb-6 font-sans">
            Your smart contract has been compiled. Sign to deploy on testnet.
          </p>
        )}

        {signError && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`${isInline ? 'mb-2' : 'mb-6'} p-3 rounded-xl bg-nb-red/5 border border-nb-red/20 flex gap-3`}
          >
            <AlertCircle className="h-4 w-4 text-nb-red shrink-0" />
            <span className="text-xs font-medium text-nb-red leading-tight">{signError}</span>
          </motion.div>
        )}

        <button
          type="button"
          onClick={handleSign}
          disabled={signing}
          className={`${isInline ? 'lg:shrink-0 w-full lg:w-auto' : 'w-full'} flex items-center justify-center gap-3 px-6 py-3 bg-nb-gold text-background font-black uppercase tracking-widest text-sm rounded-xl transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-nb-gold/30 disabled:opacity-50 disabled:cursor-not-allowed group`}
        >
          {signing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Awaiting Wallet...</span>
            </>
          ) : (
            <>
              <span>Sign &amp; Deploy</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </button>
      </div>
    </motion.div>
  )
}
