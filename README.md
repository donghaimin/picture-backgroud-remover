# Picture Background Remover

在线图片背景移除工具 - MVP

## 功能特性

- 🔐 Clerk 账号登录
- 🖼️ 图片上传支持拖拽和点击
- 🤖 AI 自动移除背景（remove.bg API）
- ⬇️ PNG 透明背景下载
- 💰 PayPal 支付购买套餐
- 📊 新用户免费 3 次

## 技术栈

- **前端**: Next.js 14 + React 18
- **样式**: Tailwind CSS
- **认证**: Clerk
- **AI**: remove.bg API
- **支付**: PayPal
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
# Clerk 配置（必须）
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
CLERK_SECRET_KEY=your-clerk-secret-key

# remove.bg API（必须）
REMOVE_BG_API_KEY=your-remove-bg-api-key

# PayPal 支付配置（必须）
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com

# PayPal Webhook（生产环境必须配置）
PAYPAL_WEBHOOK_SECRET=your-webhook-secret

# 汇率配置（可选，默认 7.2）
USD_CNY_RATE=7.2

# 站点 URL
NEXTAUTH_URL=http://localhost:3000
```

### 4. 获取 Clerk 凭证

1. 访问 [Clerk Dashboard](https://dashboard.clerk.com/)
2. 创建应用
3. 获取 Publishable Key 和 Secret Key

### 5. 获取 remove.bg API Key

1. 访问 [remove.bg](https://www.remove.bg/api)
2. 注册并获取 API Key

### 6. 配置 PayPal（开发环境）

1. 访问 [PayPal Developer](https://developer.paypal.com/dashboard/)
2. 创建 Sandbox App
3. 获取 Client ID 和 Secret

### 7. 启动开发服务器

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

在 Vercel 控制台添加环境变量。

### Cloudflare Pages

1. 连接 GitHub 仓库到 Cloudflare Pages
2. 构建命令: `npm run build`
3. 输出目录: `.next`
4. 添加环境变量

## 项目结构

```
picture-backgroud-remover/
├── app/                           # Next.js App Router
│   ├── api/
│   │   ├── credits/               # 用户额度查询 API
│   │   ├── paypal/                # PayPal 支付 API
│   │   │   ├── create-order/      # 创建订单
│   │   │   └── webhook/           # 支付回调
│   │   └── remove-bg/             # 图片处理 API
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx                   # 首页
│   └── orders/                    # 订单页面
├── components/                    # React 组件
│   ├── Auth.tsx                   # 认证组件
│   ├── UploadArea.tsx             # 上传组件
│   └── PurchaseModal.tsx          # 购买弹窗
├── public/                        # 静态资源
├── .env.example                   # 环境变量示例
├── middleware.ts                  # Clerk 中间件
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

## 环境变量说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | 是 | Clerk 公钥 |
| `CLERK_SECRET_KEY` | 是 | Clerk 密钥 |
| `REMOVE_BG_API_KEY` | 是 | remove.bg API Key |
| `PAYPAL_CLIENT_ID` | 是 | PayPal Client ID |
| `PAYPAL_CLIENT_SECRET` | 是 | PayPal Client Secret |
| `PAYPAL_BASE_URL` | 否 | PayPal API 地址（默认 sandbox） |
| `PAYPAL_WEBHOOK_SECRET` | 生产环境 | Webhook 签名验证密钥 |
| `USD_CNY_RATE` | 否 | 汇率（默认 7.2） |
| `NEXTAUTH_URL` | 是 | 站点 URL |

## 安全注意事项

1. **永远不要**将 `.env.local` 提交到 git
2. 生产环境**必须**配置 `PAYPAL_WEBHOOK_SECRET` 并启用签名验证
3. 定期更新 API 密钥
4. 使用环境变量管理所有敏感信息

## 成本估算

| 服务 | 用量 | 预估成本/月 |
|------|------|------------|
| remove.bg API | 0-50 次 | 免费 |
| remove.bg API | 50-1000 次 | ~$20-$40 |
| Clerk | 5000 MAU | 免费 |
| Vercel | Hobby | 免费 |

## License

MIT
