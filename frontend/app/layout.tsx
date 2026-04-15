import type { Metadata } from 'next'
import './globals.css'
import { AlgorandProvider } from '@/components/providers/AlgorandProvider'

export const metadata: Metadata = {
  title: 'AlgoCraft - Text-to-DApp Engine for Algorand',
  description: 'Build, deploy, and interact with Algorand DApps using natural language',
  icons: {
    icon: '/logo.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <AlgorandProvider>
          {children}
        </AlgorandProvider>
      </body>
    </html>
  )
}
