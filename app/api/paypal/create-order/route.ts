import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { setOrderCache } from '../order-cache';

// 强制动态渲染
export const dynamic = 'force-dynamic';

// PayPal 配置 - 从环境变量读取
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_BASE_URL = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';

// 汇率配置：人民币转美元
// 默认汇率：1 USD ≈ 7.2 CNY，可通过环境变量覆盖
const USD_CNY_RATE = Number(process.env.USD_CNY_RATE) || 7.2;

// 套餐配置（价格单位：人民币分）
const PACKAGES = {
  starter: { credits: 10, price: 900 },    // ¥9.00
  basic: { credits: 30, price: 2200 },     // ¥22.00
  pro: { credits: 100, price: 6000 },      // ¥60.00
};

// 将人民币分转换为美元
function convertCnyToUsd(cnyCents: number): number {
  const cnyAmount = cnyCents / 100;  // 转为人民币元
  const usdAmount = cnyAmount / USD_CNY_RATE;  // 转为美元
  return Math.round(usdAmount * 100) / 100;  // 保留两位小数
}

// 获取 PayPal Access Token
async function getAccessToken() {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal credentials not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables.');
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
    throw new Error(`PayPal authentication failed: ${data.error_description || data.error}`);
  }

  return data.access_token;
}

// 创建 PayPal 订单
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
    const { packageId } = body;

    if (!packageId || !PACKAGES[packageId as keyof typeof PACKAGES]) {
      return NextResponse.json(
        { error: '无效的套餐' },
        { status: 400 }
      );
    }

    const pkg = PACKAGES[packageId as keyof typeof PACKAGES];
    const usdPrice = convertCnyToUsd(pkg.price);

    // 获取站点 URL（修复三元运算符优先级问题）
    const baseUrl = process.env.NEXTAUTH_URL ||
                   (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
                   (req.headers.get('host') ? `https://${req.headers.get('host')}` : null) ||
                   'http://localhost:3000';

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
          reference_id: `${packageId}|${userId}|${Date.now()}`,
          description: `购买 ${pkg.credits} 次图片背景移除`,
          amount: {
            currency_code: 'USD',
            value: usdPrice.toFixed(2),
          },
        }],
        application_context: {
          brand_name: 'RemoveBG',
          landing_page: 'NO_PREFERENCE',
          user_action: 'PAY_NOW',
          return_url: `${baseUrl}/orders?success=true`,
          cancel_url: `${baseUrl}/orders?canceled=true`,
        },
      }),
    });

    const orderData = await orderResponse.json();

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

    // Store order info in cache for later retrieval during capture
    setOrderCache(orderData.id, {
      packageId,
      credits: pkg.credits,
      price: pkg.price,
      userId,
    });

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
