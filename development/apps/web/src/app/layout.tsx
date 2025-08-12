import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { SupabaseProvider } from '../providers/SupabaseProvider'
import './globals.css'
import '../styles/theme.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'NetNeural IoT Platform',
  description: 'Real-time sensor monitoring and analytics',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SupabaseProvider>
          {children}
        </SupabaseProvider>
      </body>
    </html>
  )
}
