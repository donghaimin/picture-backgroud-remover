import { auth, clerkClient } from '@clerk/nextjs';
import { NextResponse } from 'next/server';

const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY || 'njLZVzRji1mp8jUdAEihtTtp';
const INITIAL_CREDITS = 3;

export async function POST(req: Request) {
  try {
    // 1. 验证用户登录
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      );
    }

    // 2. 获取用户额度
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    
    // 从 publicMetadata 获取额度，如果没有则初始化为 3
    let credits = (user.publicMetadata?.credits as number) ?? INITIAL_CREDITS;

    // 3. 检查额度
    if (credits <= 0) {
      return NextResponse.json(
        { error: '免费额度已用完，请联系管理员充值' },
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

    // 5. 验证文件大小
    if (image.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: '图片不能超过 10MB' },
        { status: 400 }
      );
    }

    // 6. 调用 remove.bg API
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
      throw new Error('remove.bg API 调用失败');
    }

    // 7. 转换为 base64 返回
    const resultBuffer = await removeBgResponse.arrayBuffer();
    const resultBase64 = Buffer.from(resultBuffer).toString('base64');
    const resultImage = `data:image/png;base64,${resultBase64}`;

    // 8. 扣除额度并保存
    const newCredits = credits - 1;
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...user.publicMetadata,
        credits: newCredits,
      },
    });

    // 9. 返回结果
    return NextResponse.json({
      image: resultImage,
      credits: newCredits,
    });

  } catch (error) {
    console.error('Remove bg error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '处理失败，请重试' },
      { status: 500 }
    );
  }
}
