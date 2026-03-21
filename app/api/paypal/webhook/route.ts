import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';

// 强制动态渲染
export const dynamic = 'force-dynamic';

// PayPal 配置 - 必须从环境变量读取
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_BASE_URL = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID;

// 套餐配置
const PACKAGES: Record<string, { credits: number; price: number }> = {
  starter: { credits: 10, price: 900 },
  basic: { credits: 30, price: 2200 },
  pro: { credits: 100, price: 6000 },
};

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

// 验证 Webhook 签名（使用 PayPal 官方验证 API）
async function verifyWebhookSignature(
  body: string,
  authAlgo: string,
  certId: string,
  transmissionId: string,
  transmissionSig: string,
  transmissionTime: string,
): Promise<boolean> {
  // 开发环境如果没有配置 WEBHOOK_ID，跳过验证
  if (!PAYPAL_WEBHOOK_ID) {
    console.warn('PAYPAL_WEBHOOK_ID not set, skipping verification (development mode)');
    return true;
  }

  try {
    const accessToken = await getAccessToken();

    const response = await fetch(`${PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_id: certId,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: PAYPAL_WEBHOOK_ID,
        webhook_event: body,
      }),
    });

    const result = await response.json();
    const isValid = result.verification_status === 'SUCCESS';

    if (!isValid) {
      console.error('Webhook signature verification failed:', result);
    }

    return isValid;
  } catch (error) {
    console.error('Webhook verification error:', error);
    return false;
  }
}

// 检查订单是否已处理（幂等性保护）
function isOrderAlreadyProcessed(purchaseHistory: any[], orderId: string): boolean {
  return purchaseHistory.some(order => order.orderId === orderId);
}

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();

    // 获取 PayPal Webhook 验证所需的 headers
    const authAlgo = req.headers.get('paypal-auth-algo') || '';
    const certId = req.headers.get('paypal-cert-id') || '';
    const transmissionId = req.headers.get('paypal-transmission-id') || '';
    const transmissionSig = req.headers.get('paypal-transmission-sig') || '';
    const transmissionTime = req.headers.get('paypal-transmission-time') || '';

    // 验证签名
    const isValid = await verifyWebhookSignature(
      bodyText,
      authAlgo,
      certId,
      transmissionId,
      transmissionSig,
      transmissionTime,
    );

    if (!isValid) {
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
    // 新格式：packageId|userId|timestamp (使用 | 分隔符避免与 Clerk userId 的下划线冲突)
    const referenceId = resource.purchase_units?.[0]?.reference_id || '';
    const parts = referenceId.split('|');

    // 格式：packageId|userId|timestamp
    // parts[0] = packageId (starter/basic/pro)
    // parts[1] = userId (完整 Clerk userId)
    // parts[2] = timestamp
    if (parts.length < 3) {
      console.error('Invalid reference_id format:', referenceId);
      console.error('Expected format: packageId|userId|timestamp');
      return NextResponse.json({ received: true });
    }

    const packageId = parts[0];
    const userId = parts[1];

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
        ...(user.publicMetadata || {}),
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
