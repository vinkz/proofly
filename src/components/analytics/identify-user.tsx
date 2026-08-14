'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';

/**
 * Say who this is on every page load, not just at the moment they sign in.
 *
 * PostHog is initialised with `persistence: 'memory'` so the free tools need no
 * cookie banner. That choice has a consequence nothing accounted for: the
 * distinct ID is never written to the device, so it does not survive a page
 * load. identify() was only called at login, signup and Google auth, which
 * means the identity lasted until the next full navigation and then vanished.
 *
 * The effect is visible in production. On 2026-07-31 one person signed up —
 * $identify and signup_completed on session 019fb6ab — and fourteen seconds
 * later, after the redirect out of signup, they were a brand new anonymous
 * person on session 019fb6b0. Every job, certificate and invoice an engineer
 * creates lands on a throwaway person like that one, so per-user counts,
 * activation and retention cannot be computed at all.
 *
 * Re-asserting it here fixes that without storing anything on the device: the
 * identity is re-derived from the server session on each load, so the cookieless
 * posture is unchanged. Anonymous visitors are unaffected — this only renders
 * inside authenticated layouts.
 */
export function IdentifyUser({ userId, email }: { userId: string; email?: string | null }) {
  useEffect(() => {
    if (!userId) return;
    try {
      if (!posthog.__loaded) return;
      // Already correct — re-identifying would emit a redundant $identify on
      // every client navigation that remounts this.
      if (posthog.get_distinct_id() === userId) return;
      posthog.identify(userId, email ? { email } : undefined);
    } catch {
      // Analytics must never break a page.
    }
  }, [userId, email]);

  return null;
}
