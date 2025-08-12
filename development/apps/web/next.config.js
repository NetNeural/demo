/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  // Optimize for development hot reload
  typescript: {
    // Allow production builds to successfully complete even if there are type errors
    ignoreBuildErrors: false,
  },
  experimental: {
    // Enable fast refresh for better hot reload
    optimizePackageImports: ['@netneural/supabase', '@netneural/types', '@netneural/ui', '@netneural/utils'],
    // Enable faster hot reload for shared packages
    externalDir: true,
  },
  // Hot reload optimization
  reactStrictMode: true,
};

module.exports = nextConfig;
