import { auth } from '@clerk/nextjs/server';
import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getOrderCache, deleteOrderCache } from '../order-cache';

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
  console.log('Getting PayPal access token...');
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
  console.log('=== PayPal Capture Order Called ===');

  try {
    const { userId } = await auth();

    if (!userId) {
      console.log('User not authenticated');
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      );
    }

    console.log('User ID:', userId);

    const body = await req.json();
    console.log('Request body:', body);

    const { token, payerId } = body;

    if (!token) {
      console.log('Missing PayPal token');
      return NextResponse.json(
        { error: '缺少 PayPal token' },
        { status: 400 }
      );
    }

    console.log('PayPal Token:', token);
    console.log('Payer ID:', payerId);

    // 获取 Access Token
    let accessToken: string;
    try {
      accessToken = await getAccessToken();
      console.log('Got access token');
    } catch (error) {
      console.error('Failed to get access token:', error);
      return NextResponse.json(
        {
          error: 'PayPal 配置错误',
          debug: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

    // 捕获 PayPal 订单
    console.log('Capturing PayPal order:', token);
    const captureResponse = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${token}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const captureData = await captureResponse.json();
    console.log('PayPal capture response status:', captureResponse.status);
    console.log('PayPal capture response:', JSON.stringify(captureData, null, 2));

    if (!captureResponse.ok) {
      console.error('Capture failed:', captureData);
      return NextResponse.json(
        {
          error: captureData.message || '捕获支付失败',
          details: captureData,
          debug: 'PayPal API call failed'
        },
        { status: 500 }
      );
    }

    // 从缓存中获取套餐数据（使用 PayPal 订单 ID）
    const payPalOrderId = captureData.id || token;
    console.log('PayPal Order ID:', payPalOrderId);

    // 优先从缓存读取（最快）
    let cachedOrder = getOrderCache(payPalOrderId);
    let pkg: { credits: number; price: number };

    if (cachedOrder) {
      console.log('Found cached order:', cachedOrder);
      pkg = PACKAGES[cachedOrder.packageId as keyof typeof PACKAGES];
    } else {
      // 缓存未命中，从 reference_id 解析（作为后备方案）
      console.warn('Order not found in cache, parsing reference_id as fallback');
      const purchaseUnit = captureData.purchase_units?.[0];
      const referenceId = purchaseUnit?.reference_id || '';
      console.log('Reference ID:', referenceId);

      if (!referenceId) {
        return NextResponse.json(
          {
            error: '无法从 PayPal 订单中获取套餐信息',
            debug: 'PayPal 订单中没有 reference_id，且缓存未命中',
          },
          { status: 500 }
        );
      }

      // 使用 | 分隔符，格式：packageId|userId|timestamp
      const parts = referenceId.split('|');
      console.log('Reference ID parts:', parts);

      if (parts.length < 3) {
        return NextResponse.json(
          {
            error: '订单数据格式无效',
            debug: `Expected format: packageId|userId|timestamp, got: "${referenceId}"`,
            details: { parts, referenceId }
          },
          { status: 400 }
        );
      }

      const packageId = parts[0];
      console.log('Extracted Package ID:', packageId);

      pkg = PACKAGES[packageId as keyof typeof PACKAGES];

      if (!pkg) {
        return NextResponse.json(
          {
            error: '无效的套餐',
            debug: `Unknown package ID: "${packageId}". Available: ${Object.keys(PACKAGES).join(', ')}`,
          },
          { status: 400 }
        );
      }

      console.log('Found package from reference_id:', pkg);
    }

    // 更新用户额度和订单历史
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);

    const currentCredits = (user.publicMetadata?.credits as number) || 0;
    const existingHistory = (user.publicMetadata?.purchaseHistory as any[]) || [];

    // 检查订单是否已处理
    if (existingHistory.some((order: any) => order.orderId === token)) {
      console.log('Order already processed:', token);
      // Clean up cache
      deleteOrderCache(payPalOrderId);
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

    // Clean up cache
    deleteOrderCache(payPalOrderId);

    console.log(`User ${userId} purchased ${pkg.credits} credits via PayPal capture. Total: ${currentCredits + pkg.credits}`);

    return NextResponse.json({
      success: true,
      order: newOrder,
      credits: currentCredits + pkg.credits,
    });

  } catch (error) {
    console.error('Capture order error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '处理支付失败',
        debug: String(error)
      },
      { status: 500 }
    );
  }
}
