// Simple in-memory cache for PayPal order data
// In production, you'd use Redis or a database

type OrderCache = {
  packageId: string;
  credits: number;
  price: number;
  userId: string;
  createdAt: number;
};

const orderCache = new Map<string, OrderCache>();

// Clean up orders older than 1 hour to prevent memory leaks
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [key, value] of orderCache.entries()) {
    if (value.createdAt < oneHourAgo) {
      orderCache.delete(key);
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes

export function setOrderCache(orderId: string, data: OrderCache) {
  orderCache.set(orderId, { ...data, createdAt: Date.now() });
}

export function getOrderCache(orderId: string): OrderCache | undefined {
  return orderCache.get(orderId);
}

export function deleteOrderCache(orderId: string) {
  orderCache.delete(orderId);
}
