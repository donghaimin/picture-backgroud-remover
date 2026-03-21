# 部署指南

## Vercel 部署步骤

### 1. 准备工作

在部署前，你需要获取以下服务的 API 密钥：

#### Clerk (身份认证)
1. 访问 [Clerk Dashboard](https://dashboard.clerk.com/)
2. 创建新应用或选择现有应用
3. 复制以下密钥：
   - **Publishable Key**: `pk_test_...` 或 `pk_live_...`
   - **Secret Key**: `sk_test_...` 或 `sk_live_...`

#### remove.bg (AI 背景移除)
1. 访问 [remove.bg API](https://www.remove.bg/api)
2. 注册并获取 API Key

#### PayPal (支付)
1. 访问 [PayPal Developer](https://developer.paypal.com/dashboard/)
2. 创建 Sandbox App（测试）或 Live App（生产）
3. 复制 Client ID 和 Secret

---

### 2. Vercel 环境变量配置

进入你的 Vercel 项目 → **Settings** → **Environment Variables**，添加以下变量：

| 变量名 | 值 | 环境 |
|--------|-----|------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_...` | All |
| `CLERK_SECRET_KEY` | `sk_test_...` | All |
| `REMOVE_BG_API_KEY` | 你的 API Key | All |
| `PAYPAL_CLIENT_ID` | 你的 Client ID | All |
| `PAYPAL_CLIENT_SECRET` | 你的 Secret | All |
| `PAYPAL_BASE_URL` | `https://api-m.sandbox.paypal.com` | All |
| `NEXTAUTH_URL` | `https://your-domain.vercel.app` | All |
| `PAYPAL_WEBHOOK_SECRET` | Webhook 密钥 | Production |

---

### 3. 推送代码到 GitHub

```bash
git add .
git commit -m "feat: 更新环境变量配置"
git push
```

---

### 4. Vercel 自动部署

推送代码后，Vercel 会自动部署。部署完成后：

1. 访问你的 Vercel 域名
2. 点击"登录"按钮
3. 注册/登录账号
4. 测试上传图片功能

---

## 故障排查

### 问题 1: 上传图片报 500 错误

**原因**: Clerk 环境变量未配置

**解决**:
1. 检查 Vercel 环境变量是否包含 `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` 和 `CLERK_SECRET_KEY`
2. 确保值是从 Clerk Dashboard 复制的完整密钥
3. 重新部署项目

### 问题 2: 登录页面显示错误

**原因**: Clerk Publishable Key 无效

**解决**:
```bash
# 检查你的密钥格式
# 正确格式: pk_test_... 或 pk_live_...
# 错误格式: 缺少 pk_ 前缀
```

### 问题 3: remove.bg API 调用失败

**原因**: API Key 无效或配额用完

**解决**:
1. 检查 remove.bg API Key 是否正确
2. 访问 [remove.bg Dashboard](https://www.remove.bg/api) 查看剩余配额

### 问题 4: PayPal 支付无法使用

**原因**: PayPal 凭证配置错误

**解决**:
1. 确认使用的是 Sandbox 凭证（测试环境）
2. 检查 `PAYPAL_CLIENT_ID` 和 `PAYPAL_CLIENT_SECRET` 是否匹配

---

## 生产环境部署

当你准备部署到生产环境时：

1. **更新 Clerk 密钥**: 使用 `pk_live_` 和 `sk_live_` 开头的密钥
2. **更新 PayPal**: 使用生产环境的 Client ID 和 Secret
3. **配置 Webhook**: 在 PayPal Dashboard 设置 Webhook URL
   ```
   https://your-domain.com/api/paypal/webhook
   ```
4. **添加 PAYPAL_WEBHOOK_SECRET**: 从 PayPal Webhook 设置中获取

---

## 本地开发

确保 `.env.local` 文件存在（不要提交到 Git）：

```bash
cp .env.example .env.local
# 然后填入你的密钥
npm run dev
```
