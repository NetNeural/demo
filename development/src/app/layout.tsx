import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from '@/components/providers/Providers'
import { Toaster } from 'sonner'
import { SentryInit } from '@/components/SentryInit'
import { WebVitalsReporter } from '@/components/monitoring/WebVitalsReporter'

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'Sentinel by NetNeural',
  description: 'Enterprise IoT Device Management and Monitoring Platform',
  keywords: ['IoT', 'device management', 'monitoring', 'sensors', 'Golioth'],
  authors: [{ name: 'NetNeural Team' }],
  icons: {
    icon: '/icon.svg',
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
        <WebVitalsReporter />
        <Providers>
          {children}
          <Toaster theme="system" richColors />
        </Providers>
      </body>
    </html>
  )
}
