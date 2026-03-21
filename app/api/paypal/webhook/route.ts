import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import crypto from 'crypto';

// 强制动态渲染
export const dynamic = 'force-dynamic';

// PayPal 配置
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || 'AR4gIzAc3sall1DPEDw_6PIYLP6KbPQUZ7Q9Mpa3wds_VLDwmOCBEU7Z9BcWfkAIg0ABSiA5vvCrI482';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || 'EK2tmJeJwwn5cuWMi2SsPa8e_Q8Hz2u4L_JHQB8sZxKg2dossu7eMKBMNK9_grF-UyAFfmMfcXpvdxW7';
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || '';
const WEBHOOK_SECRET = process.env.PAYPAL_WEBHOOK_SECRET || '';

// 套餐配置
const PACKAGES: Record<string, { credits: number; price: number }> = {
  starter: { credits: 10, price: 900 },
  basic: { credits: 30, price: 2200 },
  pro: { credits: 100, price: 6000 },
};

// 验证 Webhook 签名
function verifyWebhookSignature(body: string, signature: string, timestamp: string): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn('WEBHOOK_SECRET not set, skipping verification');
    return true;
  }

  const message = `${timestamp}|${body}`;
  const hash = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(message)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hash));
}

// 获取 Access Token
async function getAccessToken() {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');

  const response = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();
  return data.access_token;
}

// 捕获 PayPal 订单
async function capturePayPalOrder(orderId: string) {
  const accessToken = await getAccessToken();

  const response = await fetch(`https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  return response.json();
}

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const signature = req.headers.get('paypal-transmission-sig') || '';
    const timestamp = req.headers.get('paypal-transmission-time') || '';

    // 验证签名（开发环境可跳过）
    // if (!verifyWebhookSignature(bodyText, signature, timestamp)) {
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    // }

    const event = JSON.parse(bodyText);

    console.log('PayPal webhook event:', event.event_type);

    // 只处理 CHECKOUT.ORDER.APPROVED 和 PAYMENT.CAPTURE.COMPLETED
    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED' || event.event_type === 'CHECKOUT.ORDER.APPROVED') {
      const resource = event.resource;
      
      // 从 reference_id 提取用户信息
      // 格式: userId_packageId_timestamp
      const referenceId = resource.purchase_units?.[0]?.reference_id || '';
      const [userId, packageId] = referenceId.split('_');

      if (!userId || !packageId || !PACKAGES[packageId]) {
        console.error('Invalid reference_id:', referenceId);
        return NextResponse.json({ received: true });
      }

      const pkg = PACKAGES[packageId];

      // 如果是 APPROVED 事件，需要先捕获支付
      if (event.event_type === 'CHECKOUT.ORDER.APPROVED') {
        await capturePayPalOrder(resource.id);
      }

      // 更新用户额度
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(userId);

      const currentCredits = (user.publicMetadata?.credits as number) || 0;
      const existingHistory = (user.publicMetadata?.purchaseHistory as any[]) || [];

      // 添加订单记录
      const newOrder = {
        date: new Date().toISOString(),
        amount: pkg.price,
        credits: pkg.credits,
        orderId: resource.id,
      };

      await clerk.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...user.publicMetadata,
          credits: currentCredits + pkg.credits,
          purchaseHistory: [newOrder, ...existingHistory],
        },
      });

      console.log(`User ${userId} purchased ${pkg.credits} credits. Total: ${currentCredits + pkg.credits}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook处理失败' }, { status: 500 });
  }
}
