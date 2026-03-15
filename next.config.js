/** @type {import('next').NextConfig} */
const nextConfig = {
  // 静态导出模式（适配 Cloudflare Pages）
  output: 'export',
  // 图片优化
  images: {
    unoptimized: true,
  },
  // Clerk 需要禁用一些 Next.js 功能
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
