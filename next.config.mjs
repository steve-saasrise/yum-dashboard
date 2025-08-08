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
    remotePatterns: [
      // Twitter/X images
      {
        protocol: 'https',
        hostname: 'pbs.twimg.com',
      },
      {
        protocol: 'https',
        hostname: 'abs.twimg.com',
      },
      // LinkedIn images
      {
        protocol: 'https',
        hostname: 'media.licdn.com',
      },
      {
        protocol: 'https',
        hostname: 'media-exp1.licdn.com',
      },
      {
        protocol: 'https',
        hostname: 'media-exp2.licdn.com',
      },
      // Threads/Instagram images
      {
        protocol: 'https',
        hostname: '*.cdninstagram.com',
      },
      {
        protocol: 'http',
        hostname: '*.cdninstagram.com',
      },
      {
        protocol: 'https',
        hostname: 'static.cdninstagram.com',
      },
      {
        protocol: 'http',
        hostname: 'static.cdninstagram.com',
      },
      {
        protocol: 'https',
        hostname: 'instagram.*.fna.fbcdn.net',
      },
      {
        protocol: 'https',
        hostname: 'scontent-*.cdninstagram.com',
      },
      {
        protocol: 'https',
        hostname: 'scontent.*.fna.fbcdn.net',
      },
      {
        protocol: 'https',
        hostname: 'scontent-*.instagram.com',
      },
      // Cloudinary images (commonly used in RSS feeds)
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      // Generic RSS/blog image sources
      {
        protocol: 'https',
        hostname: '*.wordpress.com',
      },
      {
        protocol: 'https',
        hostname: '*.wp.com',
      },
      {
        protocol: 'https',
        hostname: '*.medium.com',
      },
      {
        protocol: 'https',
        hostname: 'miro.medium.com',
      },
      {
        protocol: 'https',
        hostname: '*.substack.com',
      },
      {
        protocol: 'https',
        hostname: 'substackcdn.com',
      },
      {
        protocol: 'https',
        hostname: '*.substackcdn.com',
      },
      {
        protocol: 'https',
        hostname: '*.blogspot.com',
      },
      {
        protocol: 'https',
        hostname: '*.githubusercontent.com',
      },
      // Allow all HTTPS domains for RSS feed images
      // RSS feeds can pull images from any domain
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Use standalone output for Railway
  output: 'standalone',
  // Disable experimental features
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
