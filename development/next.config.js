// Import Sentry webpack plugin
const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const isStaticExport = process.env.BUILD_MODE === 'static'

const nextConfig = {
  // Enable static export for GitHub Pages deployment when BUILD_MODE=static
  ...(isStaticExport && { output: 'export' }),

  // Required for GitHub Pages deployment
  trailingSlash: true,

  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },

  // Configure base path for GitHub Pages
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
    // Enable instrumentation for Sentry
    instrumentationHook: true,
  },

  // TypeScript configuration
  typescript: {
    ignoreBuildErrors: false,
  },

  // Environment variables
  env: {
    CUSTOM_KEY: 'netneural-iot-platform',
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ]
  },

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

// Sentry configuration
const sentryWebpackPluginOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: process.env.NODE_ENV === 'production',
  autoInstrumentServerFunctions: true,
  hideSourceMaps: true,
  disableServerWebpackPlugin: process.env.NODE_ENV === 'development' || isStaticExport,
  disableClientWebpackPlugin: process.env.NODE_ENV === 'development' || isStaticExport,
};

// Export with Sentry and bundle analyzer
module.exports = withSentryConfig(
  withBundleAnalyzer(nextConfig),
  sentryWebpackPluginOptions
);
