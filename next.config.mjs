/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Enable ESLint checking during builds for better code quality
    ignoreDuringBuilds: false,
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
};

export default nextConfig;
