/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Cloudflare Workers AI 支持
  async rewrites() {
    return [
      {
        source: '/api/ai/:path*',
        destination: 'https://gateway.ai.cloudflare.com/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
