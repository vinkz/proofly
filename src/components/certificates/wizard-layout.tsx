import Link from 'next/link';
import type { ReactNode } from 'react';
import { clsx } from 'clsx';

type WizardLayoutProps = {
  step: number;
  total: number;
  title: string;
  status?: string;
  onBack?: () => void;
  children: ReactNode;
};

export function WizardLayout({ step, total, title, status, onBack, children }: WizardLayoutProps) {
  const percent = Math.round((step / total) * 100);
  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--muted)] via-white to-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-white/80 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="rounded-full border border-white/50 bg-white/90 px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm"
            >
              ← Back
            </button>
          ) : (
            <Link
              href="/jobs"
              className="rounded-full border border-white/50 bg-white/90 px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm"
            >
              ← Jobs
            </Link>
          )}
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--accent)]">Step {step} of {total}</p>
            <h1 className="text-lg font-semibold text-muted">{title}</h1>
          </div>
          {status ? (
            <span className={clsx('ml-auto rounded-full px-3 py-1 text-xs font-semibold', 'bg-[var(--muted)] text-[var(--brand)]')}>
              {status}
            </span>
          ) : null}
        </div>
        <div className="mx-auto mt-2 h-2 max-w-3xl rounded-full bg-[var(--muted)]">
          <div className="h-2 rounded-full bg-[var(--accent)] transition-all" style={{ width: `${percent}%` }} />
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">{children}</main>
    </div>
  );
}
