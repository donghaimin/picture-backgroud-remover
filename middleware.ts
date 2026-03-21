import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// 定义需要保护的路由
const isProtectedRoute = createRouteMatcher(['/orders(.*)']);

export default clerkMiddleware((auth, req) => {
  if (isProtectedRoute(req)) {
    auth().protect();
  }
});
