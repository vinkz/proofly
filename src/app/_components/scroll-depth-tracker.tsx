'use client';

import { useEffect, useRef } from 'react';

import { track, type AnalyticsEvent } from '@/lib/analytics/events';

const MILESTONES = [25, 50, 75, 100] as const;

/**
 * Report how far down a page the visitor actually got.
 *
 * A bounce currently says only that someone left. On a page whose whole job is
 * to get an engineer into a form further down, "left" and "never saw the form"
 * are very different failures with very different fixes, and we could not tell
 * them apart.
 *
 * Fires each milestone at most once per mount, on a passive listener, and does
 * nothing at all on a page short enough not to scroll — there, reaching 100% is
 * not a fact about the visitor.
 */
export function ScrollDepthTracker({ event }: { event: AnalyticsEvent }) {
  const firedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const fired = firedRef.current;

    const report = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const percent = ((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight) * 100;
      for (const milestone of MILESTONES) {
        if (percent >= milestone && !fired.has(milestone)) {
          fired.add(milestone);
          track(event, { depth: milestone });
        }
      }
    };

    // Run once on mount: a restored scroll position or a short viewport can put
    // the visitor past a milestone before they ever scroll.
    report();
    window.addEventListener('scroll', report, { passive: true });
    window.addEventListener('resize', report, { passive: true });
    return () => {
      window.removeEventListener('scroll', report);
      window.removeEventListener('resize', report);
    };
  }, [event]);

  return null;
}
