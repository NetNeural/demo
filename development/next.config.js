// Import Sentry webpack plugin
const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
// Use dynamic mode in Codespaces (for API routes), static export elsewhere
const isCodespaces = !!process.env.CODESPACE_NAME
const isStaticExport = process.env.BUILD_MODE !== 'dynamic' && !isCodespaces

const nextConfig = {
  // Static export for GitHub Pages - disabled in Codespaces for API routes
  output: isStaticExport ? 'export' : undefined,

  // Required for GitHub Pages deployment - disabled in Codespaces to avoid API route conflicts
  trailingSlash: isStaticExport ? true : false,

  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },

  // Configure base path for GitHub Pages (set NEXT_PUBLIC_BASE_PATH in your GitHub Actions)
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || '',

  // Skip ESLint during build
  eslint: {
    ignoreDuringBuilds: false,
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
  serverExternalPackages: ['@supabase/supabase-js'],

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

  // Note: Security headers and middleware don't work with static export
  // Security is handled by:
  // 1. Supabase Row Level Security (RLS) on all tables
  // 2. Supabase Edge Functions for all API calls
  // 3. Client-side authentication checks in components
  // 4. GitHub Pages HTTPS by default

  // Webpack configuration
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      }
    }

    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: ['@svgr/webpack'],
    })

    return config
  },
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

// Export with Sentry and bundle analyzer
module.exports = withSentryConfig(
  withBundleAnalyzer(nextConfig),
  sentryWebpackPluginOptions
)
