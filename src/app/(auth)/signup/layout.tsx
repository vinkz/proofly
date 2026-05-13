import Link from 'next/link';
import type { ReactNode } from 'react';

export default function SignupLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-background-secondary)]">
      <header className="sticky top-0 z-30 h-14 border-b-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
        <div className="mx-auto flex h-full max-w-md items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-extrabold tracking-tight text-[var(--brand)]">certnow</span>
            <span className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Signup</span>
          </div>
          <Link href="/login" className="text-[13px] text-[var(--color-text-secondary)]">
            Already have an account?
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 pb-16">{children}</main>
    </div>
  );
}
