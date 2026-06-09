'use client'

import { NetworkId, WalletId, WalletManager, WalletProvider } from '@txnlab/use-wallet-react'
import { ReactNode } from 'react'

const walletManager = new WalletManager({
  wallets: [
    WalletId.PERA,
    WalletId.DEFLY,
    WalletId.EXODUS,
    WalletId.LUTE
  ],
  defaultNetwork: NetworkId.TESTNET,
  networks: {
    [NetworkId.TESTNET]: {
      algod: {
        baseServer: 'https://testnet-api.algonode.cloud',
        port: 443,
        token: '',
      },
    },
    [NetworkId.MAINNET]: {
      algod: {
        baseServer: 'https://mainnet-api.algonode.cloud',
        port: 443,
        token: '',
      },
    },
  },
})

export function AlgorandProvider({ children }: { children: ReactNode }) {
  return (
    <WalletProvider manager={walletManager}>
      {children}
    </WalletProvider>
  )
}
