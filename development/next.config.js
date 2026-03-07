// Import Sentry webpack plugin
const { withSentryConfig } = require('@sentry/nextjs')
const path = require('path')
const fs = require('fs')

/** @type {import('next').NextConfig} */
// Use dynamic mode in Codespaces (for API routes), static export elsewhere
const isCodespaces = !!process.env.CODESPACE_NAME
const isStaticExport = process.env.BUILD_MODE !== 'dynamic' && !isCodespaces

// For static export: auto-remove API routes (incompatible with output: 'export')
// API routes are for local development only; Edge Functions handle production API calls
if (isStaticExport) {
  const apiDir = path.join(__dirname, 'src', 'app', 'api')
  const apiBackup = path.join(__dirname, 'src', 'app', '_api_backup')
  if (fs.existsSync(apiDir)) {
    // Move API routes aside during static build (restored by post-build or manually)
    fs.renameSync(apiDir, apiBackup)
    console.log(
      '\x1b[33m%s\x1b[0m',
      '⚠ Moved src/app/api → src/app/_api_backup (incompatible with static export)'
    )
    // Restore on process exit (covers build success, failure, and SIGINT)
    const restore = () => {
      try {
        if (fs.existsSync(apiBackup) && !fs.existsSync(apiDir)) {
          fs.renameSync(apiBackup, apiDir)
          console.log('\x1b[32m%s\x1b[0m', '✓ Restored src/app/api from backup')
        }
      } catch {
        /* ignore cleanup errors */
      }
    }
    process.on('exit', restore)
    process.on('SIGINT', () => {
      restore()
      process.exit(1)
    })
    process.on('SIGTERM', () => {
      restore()
      process.exit(1)
    })
  }
}

const nextConfig = {
  // Static export for GitHub Pages - disabled in Codespaces for API routes
  output: isStaticExport ? 'export' : undefined,

  // Required for GitHub Pages deployment - disabled in Codespaces to avoid API route conflicts
  trailingSlash: isStaticExport ? true : false,

  // Fix monorepo lockfile detection - point to the correct workspace root
  outputFileTracingRoot: path.join(__dirname),

  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },

  // Configure base path for GitHub Pages (set NEXT_PUBLIC_BASE_PATH in your GitHub Actions)
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || '',

  // Skip ESLint during build (warnings don't block; TypeScript errors still block)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Turbopack configuration
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },

  // External packages for server components
  serverExternalPackages: ['@supabase/supabase-js', 'mqtt'],

  // Experimental features for Next.js 15
  experimental: {
    ppr: false,
  },

  // TypeScript configuration
  typescript: {
    ignoreBuildErrors: false,
  },

  // Environment variables
  env: {
    CUSTOM_KEY: 'netneural-iot-platform',
  },

  // Security headers: applied in dev/server (dynamic) mode only.
  // Static export (GitHub Pages) cannot serve custom HTTP headers — security is
  // instead provided by Supabase RLS, Edge Function auth, and GitHub Pages HTTPS.
  // In dynamic mode (Codespaces, local dev, self-hosted) full HTTP headers are set.
  async headers() {
    if (isStaticExport) return []
    return [
      {
        source: '/(.*)',
        headers: [
          // Prevent MIME-type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Block framing from external origins (clickjacking)
          { key: 'X-Frame-Options', value: 'DENY' },
          // Legacy XSS filter (belt-and-suspenders for old browsers)
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // Referrer policy: send origin only on same-origin, full URL cross-origin
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // HSTS: enforce HTTPS for 1 year including subdomains
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          // Disable browser features we don't use
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co https://api.golioth.io https://staticimgly.com https://nominatim.openstreetmap.org",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },

  // Webpack configuration
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      }
    }

    // Production optimizations
    if (!dev) {
      // Enable tree shaking - remove unused exports
      config.optimization = {
        ...config.optimization,
        usedExports: true,
        sideEffects: false,
        minimize: true,
        // Split vendor chunks for better caching
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            // React and React-DOM in separate chunk
            react: {
              test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
              name: 'react-vendor',
              priority: 20,
            },
            // Radix UI components in separate chunk
            radixui: {
              test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
              name: 'radix-vendor',
              priority: 15,
            },
            // Supabase in separate chunk
            supabase: {
              test: /[\\/]node_modules[\\/]@supabase[\\/]/,
              name: 'supabase-vendor',
              priority: 15,
            },
            // Recharts (charting library)
            recharts: {
              test: /[\\/]node_modules[\\/]recharts[\\/]/,
              name: 'recharts-vendor',
              priority: 15,
            },
            // Lucide icons
            lucide: {
              test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
              name: 'lucide-vendor',
              priority: 15,
            },
            // TanStack React Query
            tanstack: {
              test: /[\\/]node_modules[\\/]@tanstack[\\/]/,
              name: 'tanstack-vendor',
              priority: 15,
            },
            // Date-fns
            datefns: {
              test: /[\\/]node_modules[\\/]date-fns[\\/]/,
              name: 'datefns-vendor',
              priority: 15,
            },
            // Sentry
            sentry: {
              test: /[\\/]node_modules[\\/]@sentry[\\/]/,
              name: 'sentry-vendor',
              priority: 15,
            },
            // Other vendor libraries (catch-all — should now be much smaller)
            vendors: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              priority: 10,
            },
            // Common code shared by multiple pages
            common: {
              minChunks: 2,
              priority: 5,
              reuseExistingChunk: true,
            },
          },
        },
      }
    }

    // For static export: ignore API routes (they're for local development only)
    if (isStaticExport && !isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@/app/api': false,
      }
    }

    // Ignore leaflet - it's loaded from CDN, not bundled
    // This prevents webpack from trying to bundle leaflet when it encounters any references
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        leaflet: false,
        fs: false,
        path: false,
        os: false,
      }

      // Exclude node-only packages from client bundle
      // Required for @imgly/background-removal (uses WASM/ONNX in browser)
      config.resolve.alias = {
        ...config.resolve.alias,
        sharp: false,
        'onnxruntime-node': false,
      }

      // Also add to externals to completely exclude from bundling
      config.externals = {
        ...config.externals,
        leaflet: 'leaflet',
      }
    }

    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: ['@svgr/webpack'],
    })

    return config
  },

  // Performance optimizations
  poweredByHeader: false, // Remove X-Powered-By header
  compress: true, // Enable gzip compression

  // Optimize production builds
  productionBrowserSourceMaps: false, // Disable source maps in prod for smaller bundles

  // Static generation optimization
  reactStrictMode: true, // Helps identify potential problems
  // Note: swcMinify removed - always enabled in Next.js 15+
}

// Bundle analyzer
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

// Sentry configuration - disabled for static export builds
const sentryWebpackPluginOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: false, // Disabled for static export
  autoInstrumentServerFunctions: false, // No server functions in static export
  hideSourceMaps: true,
  disableServerWebpackPlugin: true, // Always disabled for static export
  disableClientWebpackPlugin: process.env.NODE_ENV === 'development', // Only in dev
}

// Export with conditional Sentry (disabled for static export to avoid Html import error)
// Static export doesn't support custom error pages with <Html> from next/document
module.exports = isStaticExport
  ? withBundleAnalyzer(nextConfig)
  : withSentryConfig(withBundleAnalyzer(nextConfig), sentryWebpackPluginOptions)
