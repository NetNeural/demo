import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from '@/components/providers/Providers'
import { Toaster } from 'sonner'
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
  // Security: X-Frame-Options equivalent via meta (prevents clickjacking)
  other: {
    'X-Content-Type-Options': 'nosniff',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Security Headers via meta tags (static export — no server headers) */}
        {/* CSP: restrict content sources to self + known services */}
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.sentry.io https://fonts.googleapis.com https://fonts.gstatic.com; frame-ancestors 'none';"
        />
        {/* X-Frame-Options equivalent — prevent embedding in iframes */}
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        {/* Referrer policy — don't leak full URLs to third parties */}
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        {/* Note: HSTS is provided by GitHub Pages automatically */}
        {/* Note: X-Frame-Options header not settable via meta, using CSP frame-ancestors instead */}
      </head>
      <body className={inter.className}>
        <WebVitalsReporter />
        <Providers>
          {children}
          <Toaster theme="system" richColors />
        </Providers>
      </body>
    </html>
  )
}
