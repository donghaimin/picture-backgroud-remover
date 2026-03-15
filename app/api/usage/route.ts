import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';

// 模拟内存存储（生产环境应使用 KV/Redis）
const usageStore = new Map<string, { used: number; date: string }>();

const DAILY_LIMIT = parseInt(process.env.DAILY_FREE_LIMIT || '3');

function getToday() {
  return new Date().toISOString().split('T')[0];
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ 
        remaining: DAILY_LIMIT,
        total: DAILY_LIMIT 
      });
    }

    const email = session.user.email;
    const today = getToday();
    const record = usageStore.get(email);

    let remaining: number;
    
    if (!record || record.date !== today) {
      // 新的一天，重置计数
      remaining = DAILY_LIMIT;
      usageStore.set(email, { used: 0, date: today });
    } else {
      remaining = Math.max(0, DAILY_LIMIT - record.used);
    }

    return NextResponse.json({
      remaining,
      total: DAILY_LIMIT,
    });
  } catch (error) {
    console.error('Usage API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
