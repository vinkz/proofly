'use client';

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
        <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
          <div className="max-w-md rounded-3xl border border-white/10 bg-white/10 p-8 text-center shadow-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-300">CertNow</p>
            <h1 className="mt-4 text-3xl font-semibold">Something went wrong</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              The error has been logged. Try again, or return to the dashboard if the problem continues.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-6 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950"
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
