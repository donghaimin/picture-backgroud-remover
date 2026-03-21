import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = {
    env: process.env.NODE_ENV,
    clerk: {
      publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? '已配置' : '未配置',
      secretKey: process.env.CLERK_SECRET_KEY ? '已配置' : '未配置',
    },
    removeBg: {
      apiKey: process.env.REMOVE_BG_API_KEY ? '已配置' : '未配置',
    },
    paypal: {
      clientId: process.env.PAYPAL_CLIENT_ID ? '已配置' : '未配置',
      secretKey: process.env.PAYPAL_CLIENT_SECRET ? '已配置' : '未配置',
      baseUrl: process.env.PAYPAL_BASE_URL || '未配置',
    },
    clerkAuth: {
      working: false,
      userId: null as string | null,
    },
  };

  // 测试 Clerk 认证
  try {
    const authResult = await auth();
    config.clerkAuth.working = true;
    config.clerkAuth.userId = authResult.userId || '未登录';
  } catch (error) {
    config.clerkAuth.working = false;
  }

  return NextResponse.json(config);
}
