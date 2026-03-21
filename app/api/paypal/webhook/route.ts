import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import crypto from 'crypto';

// 强制动态渲染
export const dynamic = 'force-dynamic';

// PayPal 配置 - 必须从环境变量读取
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_BASE_URL = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';
const WEBHOOK_SECRET = process.env.PAYPAL_WEBHOOK_SECRET;

// 套餐配置
const PACKAGES: Record<string, { credits: number; price: number }> = {
  starter: { credits: 10, price: 900 },
  basic: { credits: 30, price: 2200 },
  pro: { credits: 100, price: 6000 },
};

// 验证 Webhook 签名
function verifyWebhookSignature(body: string, signature: string, timestamp: string, certUrl: string): boolean {
  // 开发环境如果没有配置 WEBHOOK_SECRET，跳过验证
  if (!WEBHOOK_SECRET) {
    console.warn('WEBHOOK_SECRET not set, skipping verification (development mode)');
    return true;
  }

  // 生产环境必须验证签名
  if (!signature || !timestamp || !certUrl) {
    console.error('Missing webhook signature headers');
    return false;
  }

  const message = `${timestamp}|${body}`;
  const hash = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(message)
    .digest('hex');

  const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hash));

  if (!isValid) {
    console.error('Webhook signature verification failed');
  }

  return isValid;
}

// 获取 Access Token
async function getAccessToken() {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal credentials not configured');
  }
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`PayPal auth failed: ${data.error_description || data.error}`);
  }

  return data.access_token;
}

// 捕获 PayPal 订单
async function capturePayPalOrder(orderId: string) {
  const accessToken = await getAccessToken();

  const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Capture failed: ${error.message || 'Unknown error'}`);
  }

  return response.json();
}

// 检查订单是否已处理（幂等性保护）
function isOrderAlreadyProcessed(purchaseHistory: any[], orderId: string): boolean {
  return purchaseHistory.some(order => order.orderId === orderId);
}

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const signature = req.headers.get('paypal-transmission-sig') || '';
    const timestamp = req.headers.get('paypal-transmission-time') || '';
    const certUrl = req.headers.get('paypal-cert-url') || '';

    // 验证签名
    if (!verifyWebhookSignature(bodyText, signature, timestamp, certUrl)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(bodyText);
    const eventType = event.event_type;

    console.log('PayPal webhook event:', eventType);

    // 只处理 PAYMENT.CAPTURE.COMPLETED 事件（支付完成）
    // 忽略 CHECKOUT.ORDER.APPROVED，因为可能不一定会完成支付
    if (eventType !== 'PAYMENT.CAPTURE.COMPLETED') {
      console.log(`Ignoring event type: ${eventType}`);
      return NextResponse.json({ received: true });
    }

    const resource = event.resource;
    const orderId = resource.id;

    // 从 reference_id 提取用户信息
    // 格式: userId_packageId_timestamp
    const referenceId = resource.purchase_units?.[0]?.reference_id || '';
    const parts = referenceId.split('_');

    if (parts.length < 2) {
      console.error('Invalid reference_id format:', referenceId);
      return NextResponse.json({ received: true });
    }

    const userId = parts[0];
    const packageId = parts[1];

    if (!userId || !packageId || !PACKAGES[packageId]) {
      console.error('Invalid package or user:', { userId, packageId });
      return NextResponse.json({ received: true });
    }

    const pkg = PACKAGES[packageId];

    // 获取用户信息
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);

    const currentCredits = (user.publicMetadata?.credits as number) || 0;
    const existingHistory = (user.publicMetadata?.purchaseHistory as any[]) || [];

    // 幂等性检查：如果订单已处理，跳过
    if (isOrderAlreadyProcessed(existingHistory, orderId)) {
      console.log(`Order ${orderId} already processed, skipping`);
      return NextResponse.json({ received: true });
    }

    // 添加订单记录
    const newOrder = {
      date: new Date().toISOString(),
      amount: pkg.price,
      credits: pkg.credits,
      orderId: orderId,
    };

    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...user.publicMetadata,
        credits: currentCredits + pkg.credits,
        purchaseHistory: [newOrder, ...existingHistory],
      },
    });

    console.log(`User ${userId} purchased ${pkg.credits} credits. Total: ${currentCredits + pkg.credits}`);

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
