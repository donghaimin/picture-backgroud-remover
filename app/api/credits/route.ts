import { auth } from '@clerk/nextjs/server';
import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const INITIAL_CREDITS = 3;

// 强制动态渲染
export const dynamic = 'force-dynamic';

// 用户元数据类型
type UserPublicMetadata = {
  credits?: number;
  hasReceivedFreeCredits?: boolean;
  registeredAt?: string;
  lastUsedAt?: string;
  purchaseHistory?: Array<{
    date: string;
    amount: number;
    credits: number;
    orderId: string;
  }>;
};

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({
        credits: 0,
        isLoggedIn: false,
      });
    }

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);

    const metadata = user.publicMetadata;

    // 如果没有额度字段，初始化为 3（仅首次）
    let credits = (metadata?.credits as number) ?? undefined;
    const hasReceivedFree = metadata?.hasReceivedFreeCredits as boolean | undefined;

    // 新用户：首次获取额度时初始化，且从未领取过免费额度
    if (credits === undefined || (credits === 0 && !hasReceivedFree)) {
      // 检查是否已经领取过免费额度（防止重复赠送）
      if (!hasReceivedFree) {
        credits = INITIAL_CREDITS;
        await clerk.users.updateUserMetadata(userId, {
          publicMetadata: {
            ...(metadata || {}),
            credits: INITIAL_CREDITS,
            hasReceivedFreeCredits: true,
            registeredAt: new Date().toISOString(),
          },
        });
      }
    }

    return NextResponse.json({
      credits: credits ?? 0,
      isLoggedIn: true,
    });

  } catch (error) {
    console.error('Credits API error:', error);
    return NextResponse.json(
      { error: '获取额度失败' },
      { status: 500 }
    );
  }
}
