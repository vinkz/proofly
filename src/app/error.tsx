'use client';

import { RouteErrorFallback } from '@/components/route-error-fallback';

/**
 * Public routes do not sit inside the authenticated or wizard route groups, so
 * they need a root segment boundary of their own. Never render `error.message`
 * here: production errors may contain provider, database, or request details.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorFallback
      error={error}
      reset={reset}
      description="We could not load this page. Try again, or return to the home page if the problem continues."
      backHref="/"
      backLabel="Back to home"
    />
  );
}
