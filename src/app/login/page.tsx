import { Suspense } from 'react';

import { LoginClient } from './login-client';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[var(--color-background-secondary)]">
      <div className="mx-auto max-w-md px-4 pt-12">
        <h1 className="text-[24px] font-medium text-[var(--color-text-primary)]">Welcome back</h1>
        <p className="mb-8 mt-2 text-[14px] text-[var(--color-text-secondary)]">
          Sign in to your CertNow account
        </p>
        <Suspense fallback={<p className="text-[13px] text-[var(--color-text-tertiary)]">Loading…</p>}>
          <LoginClient />
        </Suspense>
      </div>
    </div>
  );
}
