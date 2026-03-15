'use client';

import { ClerkProvider, SignedIn, SignedOut, UserButton, useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider 
      publishableKey="pk_test_YWNjb3VudC1tb2NrLWdsb3NzLTgyLmNsZXJrLmFjY291bnRzLmRldiQ"
    >
      {children}
    </ClerkProvider>
  );
}

export function AuthButton() {
  const { user, isLoaded } = useUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isLoaded) {
    return null;
  }

  return (
    <div className="flex items-center gap-4">
      {user ? (
        <>
          <span className="text-sm text-gray-700">{user.fullName || user.username}</span>
          <UserButton afterSignOutUrl="/" />
        </>
      ) : (
        <a
          href="/sign-in"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          登录
        </a>
      )}
    </div>
  );
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">请先登录后使用</p>
          <a
            href="/sign-in"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            登录
          </a>
        </div>
      </SignedOut>
    </>
  );
}
