import Link from 'next/link';
import type { ReactNode } from 'react';

export default function SignupLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--muted)] via-white to-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 pb-6 pt-8">
        <div className="flex items-center gap-2">
          <span className="rounded-xl bg-[var(--brand)]/15 px-3 py-2 text-lg font-extrabold text-[var(--brand)] shadow-sm">
            CertNow
          </span>
          <span className="text-xs font-semibold uppercase tracking-tight text-[var(--accent)]">Signup</span>
        </div>
        <Link href="/login" className="text-xs font-semibold text-[var(--accent)] underline underline-offset-4">
          Already have an account?
        </Link>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-16">{children}</main>
    </div>
  );
}
