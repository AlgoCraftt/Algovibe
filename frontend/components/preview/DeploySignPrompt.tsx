'use client'

import { useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import algosdk from 'algosdk'
import { useAlgoCraftStore } from '@/lib/store'
import { PenLine, Loader2, AlertCircle, Wallet, ShieldCheck, ArrowRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export function DeploySignPrompt() {
  const pendingSignature = useAlgoCraftStore((s) => s.pendingSignature)
  const completeDeployment = useAlgoCraftStore((s) => s.completeDeployment)
  const setError = useAlgoCraftStore((s) => s.setError)

  const { activeAddress, transactionSigner, algodClient } = useWallet()

  const [signing, setSigning] = useState(false)
  const [signError, setSignError] = useState<string | null>(null)

  if (!pendingSignature) return null

  if (!activeAddress) {
    return (
      <div className="rounded-2xl border border-nb-gold/30 bg-nb-gold/5 p-6 backdrop-blur-xl shadow-2xl shadow-nb-gold/10 overflow-hidden relative">
        {/* Abstract background detail */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-nb-gold/10 rounded-full blur-2xl" />
        
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-nb-gold/10 border border-nb-gold/30 mb-6 shadow-xl">
            <Wallet className="h-8 w-8 text-nb-gold" />
          </div>
          
          <h4 className="text-xl font-black gradient-text uppercase tracking-tight mb-2">Wallet Disconnected</h4>
          <p className="text-sm text-muted/80 max-w-[280px] leading-relaxed mb-6 px-4">
            A signature is required to deploy your contract. Please connect your Algorand wallet to proceed.
          </p>
          
          <div className="w-full h-px bg-nb-gold/10 mb-6" />
          
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-nb-gold/10 border border-nb-gold/20 text-[10px] font-bold uppercase tracking-widest text-nb-gold">
             <div className="w-1.5 h-1.5 rounded-full bg-nb-gold animate-ping" />
             <span>Awaiting Active Connection</span>
          </div>
        </div>
      </div>
    )
  }

  const handleSign = async () => {
    setSigning(true)
    setSignError(null)

    try {
      if (!pendingSignature.approval_teal || !pendingSignature.clear_teal) {
        throw new Error('Contract code not provided by backend')
      }

      console.log('[DeploySignPrompt] Compiling TEAL programs on Algod...')
      const appComp = await algodClient.compile(pendingSignature.approval_teal).do()
      const clearComp = await algodClient.compile(pendingSignature.clear_teal).do()

      const appBytes = Uint8Array.from(atob(appComp.result), c => c.charCodeAt(0))
      const clearBytes = Uint8Array.from(atob(clearComp.result), c => c.charCodeAt(0))

      console.log('[DeploySignPrompt] Fetching suggested params...')
      const params = await algodClient.getTransactionParams().do()

      let gi = 0, gb = 0, li = 0, lb = 0
      if (pendingSignature.arc32_spec && pendingSignature.arc32_spec.state) {
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
                  const createMethodDef = methods.find((m: any) => 
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
          appArgs: appArgs.length > 0 ? appArgs : undefined
      })

      const signedTransactions = await transactionSigner([txn], [0])
      const signedTxn = signedTransactions[0]
      const response = await algodClient.sendRawTransaction(signedTxn).do()
      const txId = (response as any).txId || (response as any).txid
      
      if (!txId) throw new Error('Failed to submit transaction: No ID returned')
      
      const confirmation = await algosdk.waitForConfirmation(algodClient, txId, 10)
      const appId = (confirmation as any)['application-index'] || 
                    (confirmation as any).applicationIndex || 
                    confirmation.applicationIndex

      if (!appId) throw new Error('Transaction succeeded but Application ID was not found')

      await completeDeployment(pendingSignature.buildId, appId.toString())
    } catch (err: any) {
      const msg = err.message || 'Signing failed'
      setSignError(msg)
      setError(msg)
    } finally {
      setSigning(false)
    }
  }

  return (
    <div className="rounded-2xl border border-nb-gold/40 bg-surface p-6 backdrop-blur-xl shadow-2xl shadow-nb-gold/10 relative overflow-hidden">
      {/* Background visual detail */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-nb-gold/10 rounded-full blur-[60px] pointer-events-none" />
      
      <div className="relative z-10">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-nb-gold/10 border border-nb-gold/30 flex items-center justify-center shadow-lg shadow-nb-gold/5">
            <PenLine className="h-6 w-6 text-nb-gold" />
          </div>
          <div>
            <h4 className="text-lg font-black uppercase tracking-tight text-foreground">Pending Signature</h4>
            <div className="flex items-center gap-2 mt-0.5">
               <ShieldCheck className="w-3 h-3 text-nb-gold" />
                <span className="text-[10px] font-bold text-nb-green/80 uppercase tracking-widest">Secure Algorand Node Ready</span>
            </div>
          </div>
        </div>

        <p className="text-sm text-muted/90 leading-relaxed mb-6 font-sans">
          Your smart contract has been architected and compiled. Sign the broadcast transaction to manifest your DApp on the Testnet.
        </p>

        {signError && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-6 p-4 rounded-xl bg-nb-red/5 border border-nb-red/20 flex gap-3"
          >
            <AlertCircle className="h-4 w-4 text-nb-red shrink-0" />
            <span className="text-xs font-medium text-nb-red leading-tight">{signError}</span>
          </motion.div>
        )}

        <button
          onClick={handleSign}
          disabled={signing}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-nb-gold text-background font-black uppercase tracking-widest text-sm rounded-xl transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-nb-gold/30 disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          {signing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Awaiting Wallet...</span>
            </>
          ) : (
            <>
              <span>Sign &amp; Propose Transaction</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
