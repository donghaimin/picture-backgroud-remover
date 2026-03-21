import { auth } from '@clerk/nextjs/server';
import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY;
const INITIAL_CREDITS = 3;

// 强制动态渲染
export const dynamic = 'force-dynamic';

// 内存锁
const pendingRequests = new Map<string, boolean>();

export async function POST(req: Request) {
  console.log('=== Remove BG API Called ===');
  
  try {
    // 1. 验证用户登录
    const { userId } = await auth();
    console.log('User ID:', userId);
    
    if (!userId) {
      console.log('User not authenticated');
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      );
    }

    // 2. 检查并发锁
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
      
      let currentCredits = user.publicMetadata?.credits as number | undefined;
      const hasReceivedFree = user.publicMetadata?.hasReceivedFreeCredits as boolean | undefined;
      
      console.log('Current credits:', currentCredits, 'Has received free:', hasReceivedFree);
      
      if (currentCredits === undefined || (currentCredits === 0 && !hasReceivedFree)) {
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

      if (currentCredits === undefined) {
        currentCredits = 0;
      }

      if (currentCredits <= 0) {
        return NextResponse.json(
          { error: '免费额度已用完，请购买套餐' },
          { status: 403 }
        );
      }

      // 4. 获取上传的图片
      const formData = await req.formData();
      const image = formData.get('image') as File | null;

      if (!image) {
        return NextResponse.json(
          { error: '请上传图片' },
          { status: 400 }
        );
      }

      // 5. 检查 API Key
      if (!REMOVE_BG_API_KEY) {
        console.error('REMOVE_BG_API_KEY is not set');
        return NextResponse.json(
          { error: '服务配置错误，请联系管理员' },
          { status: 500 }
        );
      }

      // 6. 调用 remove.bg API
      const imageBuffer = await image.arrayBuffer();
      const imageBase64 = Buffer.from(imageBuffer).toString('base64');

      console.log('Calling remove.bg API...');
      
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

      console.log('remove.bg response status:', removeBgResponse.status);

      if (!removeBgResponse.ok) {
        const errorText = await removeBgResponse.text();
        console.error('remove.bg API error:', errorText);
        throw new Error('remove.bg API 调用失败');
      }

      // 7. 返回结果
      const resultBuffer = await removeBgResponse.arrayBuffer();
      const resultBase64 = Buffer.from(resultBuffer).toString('base64');
      const resultImage = `data:image/png;base64,${resultBase64}`;

      // 8. 扣除额度
      const newCredits = currentCredits - 1;
      await clerk.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...user.publicMetadata,
          credits: newCredits,
          lastUsedAt: new Date().toISOString(),
        },
      });

      console.log('Success! New credits:', newCredits);

      return NextResponse.json({
        image: resultImage,
        credits: newCredits,
      });

    } finally {
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
