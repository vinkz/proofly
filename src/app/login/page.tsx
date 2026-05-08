import { Suspense } from 'react';
import Link from 'next/link';

import { LoginClient } from './login-client';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--muted)] to-white">
      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-10 md:flex-row md:items-start md:justify-between">
        <div className="space-y-4">
          <div className="inline-flex items-center px-3 py-1 text-xs font-semibold text-[var(--brand)]">
            certnow • Account access
          </div>
          <h1 className="text-3xl font-bold text-[var(--brand)] sm:text-4xl">Log in</h1>
          <p className="text-sm text-muted-foreground/80">
            Continue with Google, your password, or a magic link. Need an account?{' '}
            <Link href="/signup/step1" className="font-semibold text-[var(--accent)] underline underline-offset-4">
              Start signup
            </Link>
            .
          </p>
        </div>

        <Suspense
          fallback={
            <div className="w-full max-w-md rounded-2xl border border-white/60 bg-white/90 p-6 text-sm text-muted shadow-xl">
              Loading sign in…
            </div>
          }
        >
          <LoginClient />
        </Suspense>
      </div>
    </div>
  );
}
