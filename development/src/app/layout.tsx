import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from '@/components/providers/Providers'
import { Toaster } from 'sonner'
import { SentryInit } from '@/components/SentryInit'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'NetNeural IoT Platform',
  description: 'Enterprise IoT Device Management and Monitoring Platform',
  keywords: ['IoT', 'device management', 'monitoring', 'sensors', 'Golioth'],
  authors: [{ name: 'NetNeural Team' }],
  icons: {
    icon: '/favicon.ico',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <SentryInit />
        <Providers>
          {children}
          <Toaster theme="system" richColors />
        </Providers>
      </body>
    </html>
  )
}