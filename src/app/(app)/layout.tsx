import type { ReactNode } from 'react';
import Link from 'next/link';

import RequireAuth from './_components/require-auth';
import { PageFade } from './_components/page-fade';
import { HideDuringOnboarding } from './_components/hide-during-onboarding';
import { BottomNav } from '@/components/dashboard/bottom-nav';
import { ToolsMenu } from '@/components/dashboard/tools-menu';
import { listPendingJobRequestsForDashboard } from '@/server/job-requests';
import { getProfile } from '@/server/profile';

export default async function AppLayout({ children }: { children: ReactNode }) {
  let pendingRequestsCount = 0;
  try {
    const requests = await listPendingJobRequestsForDashboard();
    pendingRequestsCount = requests.length;
  } catch {
    pendingRequestsCount = 0;
  }

  // While onboarding is still incomplete, the /onboarding route renders as a
  // focused task with no global nav (see HideDuringOnboarding).
  let onboardingIncomplete = false;
  try {
    const { profile } = await getProfile();
    onboardingIncomplete =
      (profile as { onboarding_complete?: boolean | null } | null)?.onboarding_complete !== true;
  } catch {
    onboardingIncomplete = false;
  }

  return (
    <RequireAuth>
      <div className="min-h-screen bg-[var(--color-background-secondary)] text-[var(--color-text-primary)]">
        <header className="sticky top-0 z-30 border-b-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
          <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
            <Link href="/dashboard" className="flex items-center">
              <span className="text-xl font-extrabold tracking-tight text-[var(--brand)]">
                certnow
              </span>
            </Link>
            <HideDuringOnboarding active={onboardingIncomplete}>
              <ToolsMenu />
            </HideDuringOnboarding>
          </div>
        </header>

        <main className="pb-14">
          <PageFade>{children}</PageFade>
        </main>

        <HideDuringOnboarding active={onboardingIncomplete}>
          <BottomNav pendingRequestsCount={pendingRequestsCount} />
        </HideDuringOnboarding>
      </div>
    </RequireAuth>
  );
}
