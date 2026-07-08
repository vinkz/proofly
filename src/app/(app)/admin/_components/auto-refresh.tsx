'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Keeps mission control live on a phone left open: refreshes server data every
// minute and immediately when the tab regains focus.
export function AutoRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [router, intervalMs]);

  return null;
}
