/** @type {import('next').NextConfig} */
const nextConfig = {
  // 静态导出 - 适配 Cloudflare Pages
  output: 'export',
  // 图片优化需要额外配置
  images: {
    unoptimized: true,
  },
  // 禁用 API routes（Cloudflare Pages 免费版不支持后端）
  // 演示模式：跳过 API 调用
};

module.exports = nextConfig;
