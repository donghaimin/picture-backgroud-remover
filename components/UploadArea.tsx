'use client';

import { useAuth } from '@clerk/nextjs';
import { useState, useRef, useEffect } from 'react';

type ProcessingStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error';

export default function UploadArea() {
  const { isLoaded, userId } = useAuth();
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isLoaded) {
      setLoading(false);
    }
  }, [isLoaded]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('仅支持 JPG、PNG、WebP 格式');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('图片不能超过 10MB');
      return;
    }

    setError(null);
    setStatus('uploading');
    
    // 预览原图
    const reader = new FileReader();
    reader.onload = (e) => {
      setOriginalImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // 直接在前端调用 remove.bg API
    const formData = new FormData();
    formData.append('image_file', file);
    formData.append('size', 'auto');

    setStatus('processing');
    
    try {
      const res = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: {
          'X-Api-Key': 'njLZVzRji1mp8jUdAEihtTtp',
        },
        body: formData,
      });

      if (!res.ok) {
        throw new Error('API 请求失败');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setProcessedImage(url);
      setStatus('success');
    } catch (err) {
      // 如果 API 失败，返回原图作为演示
      const reader2 = new FileReader();
      reader2.onload = (e) => {
        setProcessedImage(e.target?.result as string);
        setError('演示模式：API 调用失败，显示原图');
      };
      reader2.readAsDataURL(file);
      setStatus('success');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && fileInputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInputRef.current.files = dt.files;
      handleFileSelect({ target: { files: dt.files } } as any);
    }
  };

  const handleDownload = () => {
    if (!processedImage) return;
    
    const link = document.createElement('a');
    link.href = processedImage;
    link.download = 'removed-bg.png';
    link.click();
  };

  const handleReset = () => {
    setOriginalImage(null);
    setProcessedImage(null);
    setStatus('idle');
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
      </div>
    );
  }

  // 未登录显示提示
  if (!userId) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="mb-4">
          <svg className="w-16 h-16 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">请先登录</h3>
        <p className="text-gray-600 mb-4">登录后即可使用图片背景移除功能</p>
        <a
          href="/sign-in"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          登录
        </a>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      {/* 上传区域 */}
      {status === 'idle' && (
        <div
          className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-blue-500 transition-colors"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="mb-4">
            <svg className="w-16 h-16 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          
          <p className="text-lg text-gray-700 mb-2">
            点击上传图片，或拖拽到此处
          </p>
          <p className="text-sm text-gray-500">
            支持 JPG, PNG, WebP · 最大 10MB
          </p>
        </div>
      )}

      {/* 上传中 */}
      {status === 'uploading' && (
        <div className="text-center py-12">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-700">上传中...</p>
        </div>
      )}

      {/* 处理中 */}
      {status === 'processing' && (
        <div className="text-center py-12">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-700">AI 正在移除背景...</p>
        </div>
      )}

      {/* 结果展示 */}
      {(status === 'success' || status === 'error') && (
        <div className="space-y-6">
          {/* 图片对比 */}
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-center text-sm text-gray-500 mb-2">原图</p>
              <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                {originalImage && (
                  <img src={originalImage} alt="Original" className="max-w-full max-h-full object-contain" />
                )}
              </div>
            </div>
            <div>
              <p className="text-center text-sm text-gray-500 mb-2">处理后</p>
              <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                {processedImage && (
                  <img src={processedImage} alt="Processed" className="max-w-full max-h-full object-contain" />
                )}
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-center gap-4">
            <button
              onClick={handleDownload}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              💾 下载 PNG
            </button>
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              处理下一张
            </button>
          </div>

          {/* 提示信息 */}
          {error && (
            <p className="text-center text-orange-600 text-sm">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
