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

    const credits = (user.publicMetadata?.credits as number) ?? INITIAL_CREDITS;

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
