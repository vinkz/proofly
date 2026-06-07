'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

/**
 * On-brand fallback for route-segment error boundaries (error.tsx). Renders
 * inside the root layout, so design tokens + Tailwind are already available.
 */
export function RouteErrorFallback({
  error,
  reset,
  title = 'Something went wrong',
  description = 'The error has been logged. Try again, or head back to your dashboard if the problem continues.',
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="w-full max-w-md rounded-[20px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-8 text-center shadow-sm">
        <p className="text-[11px] font-medium tracking-[0.5px] text-[var(--color-text-tertiary)]">CertNow</p>
        <h2 className="mt-3 text-[20px] font-semibold text-[var(--color-text-primary)]">{title}</h2>
        <p className="mt-2 text-[14px] leading-[1.6] text-[var(--color-text-secondary)]">{description}</p>
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
    </div>
  );
}
