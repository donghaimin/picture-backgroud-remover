import { auth } from '@clerk/nextjs/server';
import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// PayPal 配置
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || 'AR4gIzAc3sall1DPEDw_6PIYLP6KbPQUZ7Q9Mpa3wds_VLDwmOCBEU7Z9BcWfkAIg0ABSiA5vvCrI482';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || 'EK2tmJeJwwn5cuWMi2SsPa8e_Q8Hz2u4L_JHQB8sZxKg2dossu7eMKBMNK9_grF-UyAFfmMfcXpvdxW7';
const PAYPAL_BASE_URL = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';

// 套餐配置（单位：分）
const PACKAGES = {
  starter: { credits: 10, price: 900 },    // ¥9
  basic: { credits: 30, price: 2200 },     // ¥22
  pro: { credits: 100, price: 6000 },      // ¥60
};

// 获取 PayPal Access Token
async function getAccessToken() {
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
            currency_code: 'CNY',
            value: (pkg.price / 100).toFixed(2),
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

    if (!orderResponse.ok) {
      console.error('PayPal order error:', orderData);
      return NextResponse.json(
        { error: '创建订单失败' },
        { status: 500 }
      );
    }

    // 找到 approval URL
    const approvalUrl = orderData.links?.find((link: any) => link.rel === 'approve')?.href;

    return NextResponse.json({
      orderId: orderData.id,
      approvalUrl,
      packageId,
      credits: pkg.credits,
    });

  } catch (error) {
    console.error('PayPal create order error:', error);
    return NextResponse.json(
      { error: '创建订单失败' },
      { status: 500 }
    );
  }
}
