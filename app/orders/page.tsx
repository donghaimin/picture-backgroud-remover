'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Order = {
  date: string;
  amount: number;
  credits: number;
  orderId: string;
};

export default function OrdersPage() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoaded && isSignedIn && userId) {
      fetch('/api/orders')
        .then(res => res.json())
        .then(data => {
          setOrders(data.orders || []);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    } else if (isLoaded) {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, userId]);

  // 计算累计
  const totalOrders = orders.length;
  const totalCredits = orders.reduce((sum, order) => sum + order.credits, 0);

  if (loading || !isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">请先登录</h2>
          <p className="text-gray-600 mb-4">登录后即可查看历史订单</p>
          <Link href="/" className="text-blue-600 hover:underline">
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="text-blue-600 hover:underline text-sm mb-4 inline-block">
            ← 返回首页
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">📋 历史订单</h1>
        </div>

        {/* 统计 */}
        {orders.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="flex gap-8">
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">{totalOrders}</p>
                <p className="text-gray-600 text-sm">共购买次数</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">+{totalCredits}</p>
                <p className="text-gray-600 text-sm">累计额度</p>
              </div>
            </div>
          </div>
        )}

        {/* 订单列表 */}
        {orders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">暂无购买记录</h2>
            <p className="text-gray-600">购买后将在这里显示订单信息</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order, index) => (
              <div key={index} className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between">
                <div>
                  <p className="text-gray-900 font-medium">
                    {new Date(order.date).toLocaleDateString('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                  <p className="text-gray-500 text-sm">订单号: {order.orderId}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-600">+{order.credits} 次</p>
                  <p className="text-gray-600">¥{(order.amount / 100).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
