import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from '@/components/providers/Providers'
import { Toaster } from 'sonner'
import { WebVitalsReporter } from '@/components/monitoring/WebVitalsReporter'
import { CookieConsent } from '@/components/ui/CookieConsent'

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
        {/* Note: frame-ancestors is NOT supported via <meta> — only via HTTP header. */}
        {/* GitHub Pages doesn't allow custom headers, so frame-ancestors is omitted here. */}
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co https://api.sentry.io https://fonts.googleapis.com https://fonts.gstatic.com https://staticimgly.com; worker-src 'self' blob:;"
        />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        {/* Referrer policy — don't leak full URLs to third parties */}
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        {/* Legacy XSS filter for older browsers */}
        <meta httpEquiv="X-XSS-Protection" content="1; mode=block" />
        {/* Note: HSTS is provided by GitHub Pages automatically */}
        {/* Note: X-Frame-Options and Permissions-Policy require HTTP headers — */}
        {/* applied via next.config.js headers() in dynamic/server mode only.  */}
        {/* Inline theme script — runs before first paint to prevent white flash (FOUC) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var t=localStorage.getItem('theme')||'system';var palettes=['theme-slate','theme-navy','theme-emerald','theme-neutral','theme-high-contrast','theme-twilight','theme-crimson'];if(palettes.indexOf(t)!==-1){d.classList.add('dark',t)}else if(t==='dark'){d.classList.add('dark')}else if(t==='light'){d.classList.add('light')}else{if(window.matchMedia('(prefers-color-scheme:dark)').matches){d.classList.add('dark')}else{d.classList.add('light')}}}catch(e){}})()`
          }}
        />
      </head>
      <body className={inter.className}>
        <WebVitalsReporter />
        <Providers>
          {children}
          <Toaster theme="system" richColors />
          <CookieConsent />
        </Providers>
      </body>
    </html>
  )
}
