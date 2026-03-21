import { auth, currentUser } from '@clerk/nextjs/server';
import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY || 'njLZVzRji1mp8jUdAEihtTtp';
const INITIAL_CREDITS = 3;

// 强制动态渲染
export const dynamic = 'force-dynamic';

// 内存锁（仅适用于单实例部署，生产环境建议用 Redis）
const pendingRequests = new Map<string, boolean>();

export async function POST(req: Request) {
  try {
    // 1. 验证用户登录
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      );
    }

    // 2. 并发锁：防止同一用户同时多次请求
    if (pendingRequests.get(userId)) {
      return NextResponse.json(
        { error: '处理中，请稍候...' },
        { status: 429 }
      );
    }
    pendingRequests.set(userId, true);

    try {
      // 3. 获取用户额度
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(userId);
      
      // 从 publicMetadata 获取额度，如果没有则初始化为 3（新用户首次使用）
      let currentCredits = user.publicMetadata?.credits as number | undefined;
      const hasReceivedFree = user.publicMetadata?.hasReceivedFreeCredits as boolean | undefined;
      
      // 新用户首次使用：初始化额度，且从未领取过免费额度
      if (currentCredits === undefined || (currentCredits === 0 && !hasReceivedFree)) {
        // 检查是否已经领取过免费额度（防止重复赠送）
        if (!hasReceivedFree) {
          currentCredits = INITIAL_CREDITS;
          await clerk.users.updateUserMetadata(userId, {
            publicMetadata: {
              ...user.publicMetadata,
              credits: currentCredits,
              hasReceivedFreeCredits: true,
              registeredAt: new Date().toISOString(),
            },
          });
        }
      }

      // 确保额度有值（兜底）
      if (currentCredits === undefined) {
        currentCredits = 0;
      }

      // 4. 检查额度（再次确认，防止并发）
      if (currentCredits <= 0) {
        return NextResponse.json(
          { error: '免费额度已用完，请购买套餐' },
          { status: 403 }
        );
      }

      // 5. 获取上传的图片
      const formData = await req.formData();
      const image = formData.get('image') as File | null;

      if (!image) {
        return NextResponse.json(
          { error: '请上传图片' },
          { status: 400 }
        );
      }

      // 6. 验证文件大小
      if (image.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: '图片不能超过 10MB' },
          { status: 400 }
        );
      }

      // 7. 调用 remove.bg API
      const imageBuffer = await image.arrayBuffer();
      const imageBase64 = Buffer.from(imageBuffer).toString('base64');

      const removeBgResponse = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: {
          'X-Api-Key': REMOVE_BG_API_KEY,
        },
        body: JSON.stringify({
          image_file_b64: imageBase64,
          size: 'auto',
        }),
      });

      if (!removeBgResponse.ok) {
        const errorText = await removeBgResponse.text();
        console.error('remove.bg API error:', errorText);
        throw new Error('remove.bg API 调用失败');
      }

      // 8. 转换为 base64 返回
      const resultBuffer = await removeBgResponse.arrayBuffer();
      const resultBase64 = Buffer.from(resultBuffer).toString('base64');
      const resultImage = `data:image/png;base64,${resultBase64}`;

      // 9. 扣除额度并保存（原子操作）
      const newCredits = currentCredits - 1;
      await clerk.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...user.publicMetadata,
          credits: newCredits,
          lastUsedAt: new Date().toISOString(),
        },
      });

      // 10. 返回结果
      return NextResponse.json({
        image: resultImage,
        credits: newCredits,
      });

    } finally {
      // 释放锁
      pendingRequests.delete(userId);
    }

  } catch (error) {
    console.error('Remove bg error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '处理失败，请重试' },
      { status: 500 }
    );
  }
}
