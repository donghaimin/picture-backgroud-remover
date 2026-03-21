import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// PayPal 配置 - 从环境变量读取
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_BASE_URL = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';

// 套餐配置（价格单位：分）
const PACKAGES = {
  starter: { credits: 10, price: 900 },    // ¥9
  basic: { credits: 30, price: 2200 },     // ¥22
  pro: { credits: 100, price: 6000 },      // ¥60
};

// 获取 PayPal Access Token
async function getAccessToken() {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal Client ID 或 Secret 未配置');
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
    throw new Error(`PayPal认证失败: ${data.error_description || data.error}`);
  }
  
  return data.access_token;
}

// 创建 PayPal 订单
export async function POST(req: Request) {
  try {
    console.log('PAYPAL_CLIENT_ID:', PAYPAL_CLIENT_ID ? '已配置' : '未配置');
    console.log('PAYPAL_BASE_URL:', PAYPAL_BASE_URL);

    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { packageId } = body;

    if (!packageId || !PACKAGES[packageId as keyof typeof PACKAGES]) {
      return NextResponse.json(
        { error: '无效的套餐' },
        { status: 400 }
      );
    }

    const pkg = PACKAGES[packageId as keyof typeof PACKAGES];

    // 获取 Access Token
    const accessToken = await getAccessToken();

    // 创建 PayPal 订单
    const orderResponse = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: `${userId}_${packageId}_${Date.now()}`,
          description: `购买 ${pkg.credits} 次图片背景移除`,
          amount: {
            currency_code: 'USD',  // Sandbox 只支持 USD
            value: (pkg.price / 100).toFixed(2),  // 转成美元（这里为了简化，实际应该用汇率）
          },
        }],
        application_context: {
          brand_name: 'RemoveBG',
          landing_page: 'NO_PREFERENCE',
          user_action: 'PAY_NOW',
          return_url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/orders?success=true`,
          cancel_url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/orders?canceled=true`,
        },
      }),
    });

    const orderData = await orderResponse.json();
    console.log('PayPal order response:', orderData);

    if (!orderResponse.ok) {
      return NextResponse.json(
        { error: orderData.message || '创建订单失败', details: orderData },
        { status: 500 }
      );
    }

    // 找到 approval URL
    const approvalUrl = orderData.links?.find((link: any) => link.rel === 'approve')?.href;

    if (!approvalUrl) {
      return NextResponse.json(
        { error: '无法获取支付链接', details: orderData },
        { status: 500 }
      );
    }

    return NextResponse.json({
      orderId: orderData.id,
      approvalUrl,
      packageId,
      credits: pkg.credits,
    });

  } catch (error) {
    console.error('PayPal create order error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建订单失败' },
      { status: 500 }
    );
  }
}
