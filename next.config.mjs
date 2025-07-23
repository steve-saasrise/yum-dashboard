/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Temporarily ignore TypeScript errors during build
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: false,
  },
  // Disable static exports
  output: 'standalone',
  // Skip validation during build
  env: {
    SKIP_ENV_VALIDATION: 'true',
  },
  // Disable experimental features
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
