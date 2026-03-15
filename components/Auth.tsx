'use client';

import { ClerkProvider, useUser, UserButton, SignInButton } from '@clerk/nextjs';
import { useState, useEffect } from 'react';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider 
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || 'pk_test_YWNjb3VudC1tb2NrLWdsb3NzLTgyLmNsZXJrLmFjY291bnRzLmRldiQ'}
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
          <UserButton />
        </>
      ) : (
        <SignInButton mode="redirect">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
            登录
          </button>
        </SignInButton>
      )}
    </div>
  );
}
