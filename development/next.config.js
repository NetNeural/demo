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
  basePath: process.env.NODE_ENV === 'production' ? '/MonoRepo' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/MonoRepo/' : '',
  
  // Skip ESLint during build
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Turbopack configuration (moved from experimental.turbo)
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  
  // External packages for server components (moved from experimental)
  serverExternalPackages: ['@supabase/supabase-js'],
  
  // Experimental features for Next.js 15
  experimental: {
    // Enable PPR (Partial Prerendering) - Next.js 15 feature
    ppr: false, // Set to true when stable
  },
  
  // TypeScript configuration
  typescript: {
    // Fail build on type errors
    ignoreBuildErrors: false,
  },
  
  // ESLint configuration
  eslint: {
    // Fail build on lint errors
    ignoreDuringBuilds: false,
  },
  
  // Environment variables available to the browser
  env: {
    CUSTOM_KEY: 'netneural-iot-platform',
  },
  
  // Headers for security and performance
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
    // Optimize for development
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      }
    }
    
    // SVG handling
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: ['@svgr/webpack'],
    })
    
    return config
  },
  
  // Enable bundle analyzer in development
  ...(process.env.ANALYZE === 'true' && {
    experimental: {
      bundlePagesRouterDependencies: true,
    },
  }),
}

// Bundle analyzer
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

module.exports = withBundleAnalyzer(nextConfig)