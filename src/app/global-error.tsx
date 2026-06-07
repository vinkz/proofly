'use client';

// global-error renders its own <html>/<body> *outside* the root layout, so the
// root layout's `import './globals.css'` does not apply here. Without this import
// Tailwind + design tokens are absent and the page falls back to unstyled serif.
import './globals.css';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-[var(--color-background-secondary)] px-6 text-[var(--color-text-primary)]">
          <div className="w-full max-w-md rounded-[20px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-8 text-center shadow-sm">
            <p className="text-[11px] font-medium tracking-[0.5px] text-[var(--color-text-tertiary)]">CertNow</p>
            <h1 className="mt-3 text-[22px] font-semibold text-[var(--color-text-primary)]">Something went wrong</h1>
            <p className="mt-2 text-[14px] leading-[1.6] text-[var(--color-text-secondary)]">
              The error has been logged. Try again, or return to the dashboard if the problem continues.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={reset}
                className="flex h-[44px] items-center justify-center rounded-[22px] bg-[var(--color-cta)] text-[14px] font-medium text-[var(--color-cta-fg)]"
              >
                Try again
              </button>
              <a
                href="/dashboard"
                className="flex h-[44px] items-center justify-center rounded-[22px] border-[0.5px] border-[var(--color-border-secondary)] text-[14px] font-medium text-[var(--color-text-secondary)]"
              >
                Back to dashboard
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
