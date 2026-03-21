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
    try {
      const accessToken = await getAccessToken();
      console.log('Got access token');

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
      console.log('PayPal capture response:', captureData);

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

      // 从订单信息中提取套餐数据
      const purchaseUnit = captureData.purchase_units?.[0];
      const referenceId = purchaseUnit?.reference_id || '';
      console.log('Reference ID:', referenceId);

      if (!referenceId) {
        console.error('No reference_id found in capture response');
        return NextResponse.json(
          {
            error: '无法从 PayPal 订单中获取套餐信息',
            details: captureData
          },
          { status: 500 }
        );
      }

      const parts = referenceId.split('_');
      console.log('Reference ID parts:', parts);

      if (parts.length < 2) {
        console.error('Invalid reference_id format:', referenceId);
        return NextResponse.json(
          {
            error: '订单数据格式无效',
            debug: `Expected format: userId_packageId_timestamp, got: ${referenceId}`
          },
          { status: 400 }
        );
      }

      const packageId = parts[1];
      console.log('Package ID:', packageId);

      const pkg = PACKAGES[packageId];

      if (!pkg) {
        console.error('Invalid package ID:', packageId);
        return NextResponse.json(
          {
            error: '无效的套餐',
            debug: `Unknown package ID: ${packageId}`
          },
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
        console.log('Order already processed:', token);
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
      console.error('PayPal API error:', error);
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : 'PayPal API 调用失败',
          debug: String(error)
        },
        { status: 500 }
      );
    }

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
