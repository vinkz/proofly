'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Hides global app chrome (bottom nav, tools/hamburger menu) while the engineer
 * is still completing onboarding, so the /onboarding flow reads as a single
 * focused task. `active` is true only while onboarding is incomplete.
 */
export function HideDuringOnboarding({ active, children }: { active: boolean; children: ReactNode }) {
  const pathname = usePathname();
  if (active && pathname?.startsWith('/onboarding')) return null;
  return <>{children}</>;
}
