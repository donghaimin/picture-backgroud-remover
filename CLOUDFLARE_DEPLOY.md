# Cloudflare Pages 部署指南

## 快速部署

### 方法一：Cloudflare Dashboard（推荐）

1. 访问 https://dash.cloudflare.com → **Pages** → **创建项目**
2. 选择 "连接到 GitHub"
3. 授权 GitHub，选择仓库 `picture-backgroud-remover`
4. 配置如下：

| 设置 | 值 |
|------|-----|
| 项目名称 | `picture-background-remover` |
| 生产分支 | `main` |
| 构建命令 | `npm run build` |
| 构建输出目录 | `.next` |

5. 添加环境变量：

| 变量 | 值 |
|------|-----|
| `NEXTAUTH_URL` | 你的 Cloudflare 域名 |
| `NEXTAUTH_SECRET` | 随机字符串（运行 `openssl rand -base64 32` 生成） |
| `GOOGLE_CLIENT_ID` | 你的 Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | 你的 Google OAuth Client Secret |
| `REMOVE_BG_API_KEY` | `njLZVzRji1mp8jUdAEihtTtp` |

6. 点击 "保存并部署"

---

### 方法二：Wrangler CLI

```bash
# 登录 Cloudflare
npx wrangler login

# 部署
npx wrangler pages deploy .next
```

---

## 环境变量说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `NEXTAUTH_URL` | 是 | 站点 URL（如 https://xxx.pages.dev） |
| `NEXTAUTH_SECRET` | 是 | NextAuth 密钥（运行 `openssl rand -base64 32` 生成） |
| `GOOGLE_CLIENT_ID` | 是 | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | 是 | Google OAuth Client Secret |
| `REMOVE_BG_API_KEY` | 是 | remove.bg API Key |

---

## Google OAuth 配置

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建项目 → **API 和服务** → **凭据**
3. 创建 **OAuth 客户端 ID**
4. 设置回调地址：
   - 开发环境：`http://localhost:3000/api/auth/callback/google`
   - 生产环境：`https://你的域名.pages.dev/api/auth/callback/google`

---

## 常见问题

### Q: 部署后页面空白？
A: 检查构建输出目录是否设置为 `.next`

### Q: 登录失败？
A: 确保 Google OAuth 的回调地址与 NEXTAUTH_URL 匹配

### Q: API 请求失败？
A: 检查环境变量是否正确配置
