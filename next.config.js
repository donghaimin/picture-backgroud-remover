/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloudflare Pages 优化
  images: {
    unoptimized: true,
  },
  // 启用 standalone 模式以便部署
  output: 'standalone',
  // 必要的 Cloudflare Pages 设置
  transpilePackages: [],
};

module.exports = nextConfig;
