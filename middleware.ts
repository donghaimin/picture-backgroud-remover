import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// 定义需要保护的路由
const isProtectedRoute = createRouteMatcher(['/orders(.*)']);

export default clerkMiddleware((auth, req) => {
  if (isProtectedRoute(req)) {
    auth.protect();
  }
});

// 确保中间件匹配所有路由（除了静态文件和 Next.js 内部路由）
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
