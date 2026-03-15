import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';

// 模拟内存存储（生产环境应使用 KV/Redis）
const usageStore = new Map<string, { used: number; date: string }>();

const DAILY_LIMIT = parseInt(process.env.DAILY_FREE_LIMIT || '3');

function getToday() {
  return new Date().toISOString().split('T')[0];
}

// Cloudflare Workers AI API 调用的帮助函数
async function removeBackgroundWithCloudflare(imageData: ArrayBuffer): Promise<ArrayBuffer> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error('Cloudflare 配置未完成');
  }

  // 将 ArrayBuffer 转换为 Base64
  const base64 = Buffer.from(imageData).toString('base64');
  const mimeType = 'image/png'; // 假设输入是 PNG

  const response = await fetch(
    `https://gateway.ai.cloudflare.com/v1/${accountId}/images-v1/automatic`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountId,
        image: base64,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Cloudflare API error: ${error}`);
  }

  return response.arrayBuffer();
}

// 使用 remove.bg API（备选方案）
async function removeBackgroundWithRemoveBg(imageData: ArrayBuffer): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([imageData], { type: 'image/png' });
  formData.append('image_file', blob, 'image.png');
  formData.append('size', 'auto');

  const response = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: {
      'X-Api-Key': process.env.REMOVE_BG_API_KEY || '',
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to remove background');
  }

  const buffer = await response.arrayBuffer();
  return `data:image/png;base64,${Buffer.from(buffer).toString('base64')}`;
}

export async function POST(request: Request) {
  try {
    // 检查登录
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      );
    }

    const email = session.user.email;
    const today = getToday();

    // 检查并更新使用次数
    let record = usageStore.get(email);
    
    if (!record || record.date !== today) {
      // 新的一天
      record = { used: 0, date: today };
      usageStore.set(email, record);
    }

    if (record.used >= DAILY_LIMIT) {
      return NextResponse.json(
        { error: '今日免费次数已用完' },
        { status: 403 }
      );
    }

    // 获取上传的图片
    const formData = await request.formData();
    const image = formData.get('image') as File | null;

    if (!image) {
      return NextResponse.json(
        { error: '请上传图片' },
        { status: 400 }
      );
    }

    // 验证文件大小
    if (image.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: '图片不能超过 10MB' },
        { status: 400 }
      );
    }

    // 验证文件类型
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(image.type)) {
      return NextResponse.json(
        { error: '仅支持 JPG、PNG、WebP 格式' },
        { status: 400 }
      );
    }

    // 读取图片数据
    const imageData = await image.arrayBuffer();

    let resultImage: string;

    // 优先使用 Cloudflare Workers AI
    if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) {
      try {
        const result = await removeBackgroundWithCloudflare(imageData);
        resultImage = `data:image/png;base64,${Buffer.from(result).toString('base64')}`;
      } catch (cfError) {
        console.error('Cloudflare AI failed, trying remove.bg:', cfError);
        // 如果 Cloudflare 失败，尝试 remove.bg
        if (process.env.REMOVE_BG_API_KEY) {
          resultImage = await removeBackgroundWithRemoveBg(imageData);
        } else {
          throw cfError;
        }
      }
    } else if (process.env.REMOVE_BG_API_KEY) {
      // 使用 remove.bg
      resultImage = await removeBackgroundWithRemoveBg(imageData);
    } else {
      // 演示模式：返回原图（带提示）
      resultImage = `data:image/png;base64,${Buffer.from(imageData).toString('base64')}`;
    }

    // 更新使用次数
    record.used += 1;
    const remaining = DAILY_LIMIT - record.used;

    return NextResponse.json({
      image: resultImage,
      remaining,
      message: process.env.CLOUDFLARE_ACCOUNT_ID ? undefined : '演示模式：未配置 AI 服务',
    });
  } catch (error) {
    console.error('Remove BG error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '处理失败，请重试' },
      { status: 500 }
    );
  }
}
