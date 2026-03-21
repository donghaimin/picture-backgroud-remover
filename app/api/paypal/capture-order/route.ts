import { auth } from '@clerk/nextjs/server';
import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// 强制动态渲染
export const dynamic = 'force-dynamic';

// PayPal 配置
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_BASE_URL = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';

// 套餐配置
const PACKAGES: Record<string, { credits: number; price: number }> = {
  starter: { credits: 10, price: 900 },
  basic: { credits: 30, price: 2200 },
  pro: { credits: 100, price: 6000 },
};

// 获取 PayPal Access Token
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

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { token, payerId } = body;

    if (!token) {
      return NextResponse.json(
        { error: '缺少 PayPal token' },
        { status: 400 }
      );
    }

    // 获取 Access Token
    const accessToken = await getAccessToken();

    // 捕获 PayPal 订单
    const captureResponse = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${token}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const captureData = await captureResponse.json();

    if (!captureResponse.ok) {
      console.error('Capture failed:', captureData);
      return NextResponse.json(
        { error: captureData.message || '捕获支付失败' },
        { status: 500 }
      );
    }

    // 从订单信息中提取套餐数据
    const purchaseUnit = captureData.purchase_units?.[0];
    const referenceId = purchaseUnit?.reference_id || '';
    const parts = referenceId.split('_');

    if (parts.length < 2) {
      console.error('Invalid reference_id:', referenceId);
      return NextResponse.json(
        { error: '订单数据无效' },
        { status: 400 }
      );
    }

    const packageId = parts[1];
    const pkg = PACKAGES[packageId];

    if (!pkg) {
      return NextResponse.json(
        { error: '无效的套餐' },
        { status: 400 }
      );
    }

    // 更新用户额度和订单历史
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);

    const currentCredits = (user.publicMetadata?.credits as number) || 0;
    const existingHistory = (user.publicMetadata?.purchaseHistory as any[]) || [];

    // 检查订单是否已处理
    if (existingHistory.some((order: any) => order.orderId === token)) {
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        credits: currentCredits,
      });
    }

    // 添加新订单
    const newOrder = {
      date: new Date().toISOString(),
      amount: pkg.price,
      credits: pkg.credits,
      orderId: token,
    };

    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...(user.publicMetadata || {}),
        credits: currentCredits + pkg.credits,
        purchaseHistory: [newOrder, ...existingHistory],
      },
    });

    console.log(`User ${userId} purchased ${pkg.credits} credits via PayPal capture. Total: ${currentCredits + pkg.credits}`);

    return NextResponse.json({
      success: true,
      order: newOrder,
      credits: currentCredits + pkg.credits,
    });

  } catch (error) {
    console.error('Capture order error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '处理支付失败' },
      { status: 500 }
    );
  }
}
