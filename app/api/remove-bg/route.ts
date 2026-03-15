import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';

// 模拟内存存储（生产环境应使用 KV/Redis）
const usageStore = new Map<string, { used: number; date: string }>();

const DAILY_LIMIT = parseInt(process.env.DAILY_FREE_LIMIT || '3');

function getToday() {
  return new Date().toISOString().split('T')[0];
}

// 使用 remove.bg API
async function removeBackgroundWithRemoveBg(imageData: ArrayBuffer, contentType: string): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([imageData], { type: contentType });
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
    
    // 演示模式：不需要登录也能测试
    const email = session?.user?.email || 'demo@example.com';
    const today = getToday();

    // 检查并更新使用次数
    let record = usageStore.get(email);
    
    if (!record || record.date !== today) {
      // 新的一天
      record = { used: 0, date: today };
      usageStore.set(email, record);
    }

    if (session?.user && record.used >= DAILY_LIMIT) {
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
    const contentType = image.type;

    let resultImage: string;
    let isDemo = true;

    // 优先使用 remove.bg
    if (process.env.REMOVE_BG_API_KEY) {
      try {
        resultImage = await removeBackgroundWithRemoveBg(imageData, contentType);
        isDemo = false;
      } catch (apiError) {
        console.error('remove.bg API failed:', apiError);
        // API 失败时返回原图
        resultImage = `data:${contentType};base64,${Buffer.from(imageData).toString('base64')}`;
      }
    } else {
      // 演示模式：直接返回原图
      resultImage = `data:${contentType};base64,${Buffer.from(imageData).toString('base64')}`;
    }

    // 更新使用次数（登录用户才计数）
    if (session?.user) {
      record.used += 1;
    }
    const remaining = Math.max(0, DAILY_LIMIT - record.used);

    return NextResponse.json({
      image: resultImage,
      remaining,
      message: isDemo ? '演示模式：未配置 AI 服务，返回原图' : undefined,
    });
  } catch (error) {
    console.error('Remove BG error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '处理失败，请重试' },
      { status: 500 }
    );
  }
}
