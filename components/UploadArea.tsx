'use client';

import { useState, useRef } from 'next-auth/react';

import type { Session } from 'next-auth';

interface UploadAreaProps {
  session?: Session | null;
}

type ProcessingStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error';

export default function UploadArea({ session }: UploadAreaProps) {
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLoggedIn = !!session?.user;

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

    // 上传并处理
    const formData = new FormData();
    formData.append('image', file);

    setStatus('processing');
    
    try {
      const res = await fetch('/api/remove-bg', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '处理失败');
      }

      const data = await res.json();
      setProcessedImage(data.image);
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : '处理失败，请重试');
      setStatus('error');
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

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      {/* 上传区域 */}
      {status === 'idle' && (
        <div
          className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-primary transition-colors"
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
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-700">上传中...</p>
        </div>
      )}

      {/* 处理中 */}
      {status === 'processing' && (
        <div className="text-center py-12">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
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
                {status === 'success' && processedImage ? (
                  <img src={processedImage} alt="Processed" className="max-w-full max-h-full object-contain" />
                ) : status === 'error' ? (
                  <p className="text-error p-4 text-center">{error}</p>
                ) : null}
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-center gap-4">
            {status === 'success' ? (
              <>
                <button
                  onClick={handleDownload}
                  className="px-6 py-3 bg-success text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
                >
                  💾 下载 PNG
                </button>
                <button
                  onClick={handleReset}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  处理下一张
                </button>
              </>
            ) : (
              <button
                onClick={handleReset}
                className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium"
              >
                重新上传
              </button>
            )}
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {error && status === 'idle' && (
        <div className="mt-4 p-4 bg-red-50 rounded-lg">
          <p className="text-error text-center">{error}</p>
        </div>
      )}
    </div>
  );
}
