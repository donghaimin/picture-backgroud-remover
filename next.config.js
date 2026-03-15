/** @type {import('next').NextConfig} */
const nextConfig = {
  // 静态导出模式
  output: 'export',
  // 图片优化
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
