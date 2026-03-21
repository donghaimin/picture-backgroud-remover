import { auth } from '@clerk/nextjs/server';
import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// 内存存储订单（等接入PayPal后改为数据库）
// key: userId, value: Order[]
const ordersStore = new Map<string, any[]>();

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ orders: [] });
    }

    // 从 Clerk 获取订单历史
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    
    const purchaseHistory = user.publicMetadata?.purchaseHistory as any[] | undefined;
    const orders = purchaseHistory || [];

    return NextResponse.json({ orders });

  } catch (error) {
    console.error('Orders API error:', error);
    return NextResponse.json(
      { error: '获取订单失败' },
      { status: 500 }
    );
  }
}

// 添加订单（支付成功回调使用）
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
    const { amount, credits, orderId } = body;

    if (!amount || !credits || !orderId) {
      return NextResponse.json(
        { error: '参数不完整' },
        { status: 400 }
      );
    }

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);

    // 获取现有订单历史
    const existingHistory = (user.publicMetadata?.purchaseHistory as any[]) || [];
    
    // 添加新订单
    const newOrder = {
      date: new Date().toISOString(),
      amount,
      credits,
      orderId,
    };

    const newHistory = [newOrder, ...existingHistory];

    // 更新用户额度
    const currentCredits = (user.publicMetadata?.credits as number) || 0;

    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...user.publicMetadata,
        credits: currentCredits + credits,
        purchaseHistory: newHistory,
      },
    });

    return NextResponse.json({ 
      success: true, 
      order: newOrder,
      credits: currentCredits + credits
    });

  } catch (error) {
    console.error('Add order error:', error);
    return NextResponse.json(
      { error: '添加订单失败' },
      { status: 500 }
    );
  }
}
