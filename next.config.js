/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel 部署不需要 static export
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
