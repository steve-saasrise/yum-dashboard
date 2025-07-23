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
  // Use standalone output for Railway
  output: 'standalone',
  // Disable experimental features
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
