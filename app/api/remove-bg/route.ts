import { auth } from '@clerk/nextjs/server';
import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY;
const INITIAL_CREDITS = 3;

// 强制动态渲染
export const dynamic = 'force-dynamic';

// 内存锁
// 注意：此锁仅在单实例环境下有效。多实例部署时请使用 Redis 或其他分布式锁机制
const pendingRequests = new Map<string, boolean>();

export async function POST(req: Request) {
  console.log('=== /api/remove-bg called ===');

  try {
    // 1. 验证用户登录
    console.log('Step 1: Checking auth...');
    let userId: string | null = null;

    try {
      const authResult = await auth();
      userId = authResult.userId;
      console.log('User ID:', userId);
    } catch (authError) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: '认证失败，请重新登录', debug: 'Auth check failed' },
        { status: 401 }
      );
    }

    if (!userId) {
      console.log('No userId found');
      return NextResponse.json(
        { error: '请先登录', debug: 'No userId' },
        { status: 401 }
      );
    }

    // 2. 检查并发锁
    console.log('Step 2: Checking pending requests...');
    if (pendingRequests.get(userId)) {
      console.log('User has pending request');
      return NextResponse.json(
        { error: '处理中，请稍候...' },
        { status: 429 }
      );
    }
    pendingRequests.set(userId, true);

    try {
      // 3. 获取用户额度
      console.log('Step 3: Getting user credits...');
      let currentCredits: number;
      let metadata: any;

      try {
        const clerk = await clerkClient();
        const user = await clerk.users.getUser(userId);
        metadata = user.publicMetadata || {};
        currentCredits = (metadata.credits as number) ?? 0;

        console.log('Current credits:', currentCredits);
        console.log('Has received free:', metadata.hasReceivedFreeCredits);
      } catch (clerkError) {
        console.error('Clerk error:', clerkError);
        return NextResponse.json(
          { error: '获取用户信息失败', debug: String(clerkError) },
          { status: 500 }
        );
      }

      // 首次使用初始化额度
      if (currentCredits === 0 && !metadata.hasReceivedFreeCredits) {
        console.log('Initializing free credits for new user...');
        try {
          const clerk = await clerkClient();
          await clerk.users.updateUserMetadata(userId, {
            publicMetadata: {
              ...metadata,
              credits: INITIAL_CREDITS,
              hasReceivedFreeCredits: true,
              registeredAt: new Date().toISOString(),
            },
          });
          currentCredits = INITIAL_CREDITS;
          console.log('Credits initialized:', currentCredits);
        } catch (initError) {
          console.error('Init credits error:', initError);
          return NextResponse.json(
            { error: '初始化额度失败', debug: String(initError) },
            { status: 500 }
          );
        }
      }

      if (currentCredits <= 0) {
        console.log('No credits left');
        return NextResponse.json(
          { error: '免费额度已用完，请购买套餐' },
          { status: 403 }
        );
      }

      // 4. 获取上传的图片
      console.log('Step 4: Parsing form data...');
      let formData: FormData;
      let image: File | null;

      try {
        formData = await req.formData();
        image = formData.get('image') as File | null;
      } catch (formError) {
        console.error('Form data error:', formError);
        return NextResponse.json(
          { error: '解析上传数据失败', debug: String(formError) },
          { status: 400 }
        );
      }

      if (!image) {
        console.log('No image uploaded');
        return NextResponse.json(
          { error: '请上传图片' },
          { status: 400 }
        );
      }

      console.log('Image details:', {
        name: image.name,
        type: image.type,
        size: image.size,
      });

      // 验证文件类型
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(image.type)) {
        console.log('Invalid image type:', image.type);
        return NextResponse.json(
          { error: '仅支持 JPG、PNG、WebP 格式' },
          { status: 400 }
        );
      }

      // 验证文件大小（10MB）
      const maxSize = 10 * 1024 * 1024;
      if (image.size > maxSize) {
        console.log('Image too large:', image.size);
        return NextResponse.json(
          { error: '图片不能超过 10MB' },
          { status: 400 }
        );
      }

      // 5. 检查 API Key
      console.log('Step 5: Checking API key...');
      if (!REMOVE_BG_API_KEY) {
        console.error('REMOVE_BG_API_KEY is not set');
        return NextResponse.json(
          { error: '服务配置错误，请联系管理员', debug: 'Missing API key' },
          { status: 500 }
        );
      }

      // 6. 调用 remove.bg API
      console.log('Step 6: Calling remove.bg API...');
      let imageBuffer: ArrayBuffer;
      let removeBgResponse: Response;

      try {
        imageBuffer = await image.arrayBuffer();
        const imageBase64 = Buffer.from(imageBuffer).toString('base64');

        console.log('Sending request to remove.bg...');

        removeBgResponse = await fetch('https://api.remove.bg/v1.0/removebg', {
          method: 'POST',
          headers: {
            'X-Api-Key': REMOVE_BG_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image_file_b64: imageBase64,
            size: 'auto',
          }),
        });

        console.log('remove.bg response status:', removeBgResponse.status);
      } catch (fetchError) {
        console.error('Fetch error:', fetchError);
        return NextResponse.json(
          { error: '调用 AI 服务失败', debug: String(fetchError) },
          { status: 500 }
        );
      }

      if (!removeBgResponse.ok) {
        const errorText = await removeBgResponse.text();
        console.error('remove.bg API error:', {
          status: removeBgResponse.status,
          body: errorText,
        });

        if (removeBgResponse.status === 402) {
          return NextResponse.json(
            { error: 'API 配额已用完，请联系管理员' },
            { status: 503 }
          );
        }

        if (removeBgResponse.status === 401) {
          return NextResponse.json(
            { error: 'API 密钥无效' },
            { status: 500 }
          );
        }

        return NextResponse.json(
          { error: `图片处理失败 (${removeBgResponse.status})`, debug: errorText },
          { status: 500 }
        );
      }

      // 7. 返回结果
      console.log('Step 7: Processing result...');
      const resultBuffer = await removeBgResponse.arrayBuffer();
      const resultBase64 = Buffer.from(resultBuffer).toString('base64');
      const resultImage = `data:image/png;base64,${resultBase64}`;

      // 8. 扣除额度
      console.log('Step 8: Updating credits...');
      try {
        const clerk = await clerkClient();
        const newCredits = currentCredits - 1;
        await clerk.users.updateUserMetadata(userId, {
          publicMetadata: {
            ...metadata,
            credits: newCredits,
            lastUsedAt: new Date().toISOString(),
          },
        });
        console.log('Credits updated:', newCredits);

        return NextResponse.json({
          image: resultImage,
          credits: newCredits,
        });
      } catch (updateError) {
        console.error('Update credits error:', updateError);
        // 即使更新失败，也返回图片
        return NextResponse.json({
          image: resultImage,
          credits: currentCredits - 1,
          warning: '额度更新失败，但图片处理成功',
        });
      }

    } finally {
      pendingRequests.delete(userId);
    }

  } catch (error) {
    console.error('=== UNEXPECTED ERROR ===');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '处理失败，请重试',
        debug: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    );
  }
}
