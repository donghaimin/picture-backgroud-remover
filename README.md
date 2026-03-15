# Picture Background Remover

在线图片背景移除工具 - MVP

## 功能特性

- 🔐 Google 账号登录
- 🖼️ 图片上传支持拖拽和点击
- 🤖 AI 自动移除背景
- ⬇️ PNG 透明背景下载
- 📊 每日免费 3 次

## 技术栈

- **前端**: Next.js 14 + React 18
- **样式**: Tailwind CSS
- **认证**: NextAuth.js (Google OAuth)
- **AI**: Cloudflare Workers AI / remove.bg
- **部署**: Vercel / Cloudflare Pages

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/donghaimin/picture-backgroud-remover.git
cd picture-backgroud-remover
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env.local
```

编辑 `.env.local`，填入以下配置：

```env
# NextAuth 配置
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here

# Google OAuth（必须）
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Cloudflare Workers AI（可选，推荐）
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token

# 或使用 remove.bg（可选）
REMOVE_BG_API_KEY=your-remove-bg-api-key

# 每日免费次数
DAILY_FREE_LIMIT=3
```

### 4. 获取 Google OAuth 凭证

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建项目
3. 启用 Google+ API / People API
4. 创建 OAuth 2.0 客户端 ID
5. 设置回调地址: `http://localhost:3000/api/auth/callback/google`

### 5. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## 部署

### Vercel（推荐）

```bash
npm i -g vercel
vercel
```

### Cloudflare Pages

1. 连接 GitHub 仓库到 Cloudflare Pages
2. 构建命令: `npm run build`
3. 输出目录: `.next`
4. 添加环境变量

## 项目结构

```
picture-backgroud-remover/
├── app/                    # Next.js App Router
│   ├── api/
│   │   ├── auth/          # NextAuth 路由
│   │   ├── remove-bg/     # 图片处理 API
│   │   └── usage/         # 限流查询 API
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx           # 首页
├── components/            # React 组件
│   ├── Header.tsx
│   └── UploadArea.tsx
├── lib/                   # 工具函数
│   └── auth.ts
├── public/                # 静态资源
├── .env.example           # 环境变量示例
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

## 环境变量说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `NEXTAUTH_URL` | 是 | 站点 URL |
| `NEXTAUTH_SECRET` | 是 | NextAuth 密钥 |
| `GOOGLE_CLIENT_ID` | 是 | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | 是 | Google OAuth Client Secret |
| `CLOUDFLARE_ACCOUNT_ID` | 否 | Cloudflare 账号 ID |
| `CLOUDFLARE_API_TOKEN` | 否 | Cloudflare API Token |
| `REMOVE_BG_API_KEY` | 否 | remove.bg API Key |
| `DAILY_FREE_LIMIT` | 否 | 每日免费次数（默认 3） |

## 成本估算

| 规模 | 每日请求 | 预估成本/月 |
|------|---------|------------|
| 个人使用 | 10 | 免费 |
| 100 用户 | 300 | ~$5 |
| 1,000 用户 | 3,000 | ~$50 |

## License

MIT
