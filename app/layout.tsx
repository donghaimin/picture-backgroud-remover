import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider, AuthButton } from '@/components/Auth';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '图片背景移除工具',
  description: '快速、免费、无需下载软件，在线去除图片背景',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <AuthProvider>
          <header className="bg-white border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <a href="/" className="flex items-center">
                  <span className="text-xl font-bold text-blue-600">🖼️ RemoveBG</span>
                </a>
                <AuthButton />
              </div>
            </div>
          </header>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
