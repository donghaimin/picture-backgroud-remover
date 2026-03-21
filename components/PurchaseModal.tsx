'use client';

import { useState } from 'react';

type Package = {
  id: string;
  name: string;
  credits: number;
  price: number;
  pricePerCredit: number;
  recommended?: boolean;
};

const packages: Package[] = [
  {
    id: 'starter',
    name: '体验包',
    credits: 10,
    price: 9,
    pricePerCredit: 0.9,
  },
  {
    id: 'basic',
    name: '基础包',
    credits: 30,
    price: 22,
    pricePerCredit: 0.73,
    recommended: true,
  },
  {
    id: 'pro',
    name: '专业包',
    credits: 100,
    price: 60,
    pricePerCredit: 0.6,
  },
];

type Props = {
  isOpen: boolean;
  onClose: () => void;
  currentCredits: number;
};

export default function PurchaseModal({ isOpen, onClose, currentCredits }: Props) {
  const [selectedPackage, setSelectedPackage] = useState<string>('starter');
  const [purchasing, setPurchasing] = useState(false);

  if (!isOpen) return null;

  const handlePurchase = async () => {
    setPurchasing(true);
    
    // 模拟支付流程（等接入PayPal后替换）
    setTimeout(() => {
      alert('支付功能开发中，敬请期待！');
      setPurchasing(false);
      onClose();
    }, 1000);
  };

  const selected = packages.find(p => p.id === selectedPackage)!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩 */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      
      {/* 弹窗 */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* 标题 */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">💎</div>
          <h2 className="text-2xl font-bold text-gray-900">购买套餐</h2>
          <p className="text-gray-600">当前剩余：{currentCredits} 次</p>
        </div>

        {/* 套餐选择 */}
        <div className="space-y-3 mb-6">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              onClick={() => setSelectedPackage(pkg.id)}
              className={`relative border-2 rounded-xl p-4 cursor-pointer transition-all ${
                selectedPackage === pkg.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {pkg.recommended && (
                <span className="absolute -top-2 right-4 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                  推荐
                </span>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-gray-900">{pkg.name}</span>
                  <span className="text-gray-500 ml-2">{pkg.credits} 次</span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold text-gray-900">¥{pkg.price}</span>
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                ¥{pkg.pricePerCredit.toFixed(2)}/次
              </p>
            </div>
          ))}
        </div>

        {/* 购买按钮 */}
        <button
          onClick={handlePurchase}
          disabled={purchasing}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {purchasing ? '处理中...' : `¥${selected.price} 购买 ${selected.credits} 次`}
        </button>

        {/* 提示 */}
        <p className="text-center text-gray-500 text-sm mt-4">
          点击购买后将跳转至支付页面
        </p>
      </div>
    </div>
  );
}
