import { auth } from '@clerk/nextjs/server';
import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const INITIAL_CREDITS = 3;

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

    // 如果没有额度字段，初始化为 3（仅首次）
    // 如果已有额度字段，保持原值（不重复发放）
    let credits = user.publicMetadata?.credits as number | undefined;
    
    // 新用户：首次获取额度时初始化
    if (credits === undefined) {
      credits = INITIAL_CREDITS;
      await clerk.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...user.publicMetadata,
          credits: INITIAL_CREDITS,
          registeredAt: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json({
      credits,
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
