import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // Enable experimental features as needed
  },
  transpilePackages: ['@netneural/ui', '@netneural/types', '@netneural/utils']
};

export default nextConfig;
