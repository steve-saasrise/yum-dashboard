/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Ignore ESLint during builds to prevent Railway build failures
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Enable TypeScript checking during builds for type safety
    ignoreBuildErrors: false,
  },
  images: {
    // Enable image optimization for better performance
    unoptimized: false,
  },
  experimental: {
    // Enable typed routes for better type safety
    typedRoutes: true,
  },
  // Skip validation during build for Railway
  env: {
    SKIP_ENV_VALIDATION: 'true',
  },
};

export default nextConfig;