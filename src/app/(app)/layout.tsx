import type { ReactNode } from 'react';
import Link from 'next/link';

import RequireAuth from './_components/require-auth';
import { PageFade } from './_components/page-fade';
import { HideDuringOnboarding } from './_components/hide-during-onboarding';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { BottomNav } from '@/components/dashboard/bottom-nav';
import { ToolsMenu } from '@/components/dashboard/tools-menu';
import { listPendingJobRequestsForDashboard } from '@/server/job-requests';
import { getProfile } from '@/server/profile';
import { IdentifyUser } from '@/components/analytics/identify-user';
import { getSupabaseUser, supabaseServerReadOnly } from '@/lib/supabaseServer';

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Analytics identity only. RequireAuth below is what actually gates the page;
  // a failure here must never keep an engineer out of their own dashboard.
  let analyticsUser: { id: string; email?: string } | null = null;
  try {
    const supabase = await supabaseServerReadOnly();
    const user = await getSupabaseUser(supabase);
    if (user) analyticsUser = { id: user.id, email: user.email ?? undefined };
  } catch {
    analyticsUser = null;
  }

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
      {analyticsUser ? (
        <IdentifyUser userId={analyticsUser.id} email={analyticsUser.email} />
      ) : null}
      <div className="min-h-screen bg-[var(--color-background-secondary)] text-[var(--color-text-primary)] lg:flex">
        {/* Desktop (>=1024px): sidebar nav. Hidden while onboarding (focused flow). */}
        <HideDuringOnboarding active={onboardingIncomplete}>
          <AppSidebar pendingRequestsCount={pendingRequestsCount} />
        </HideDuringOnboarding>

        <div className="flex min-h-screen flex-1 flex-col">
          {/* Mobile (<1024px) only: brand + tools header. Desktop uses the sidebar instead. */}
          <header className="sticky top-0 z-30 border-b-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] lg:hidden">
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

          <main className="pb-14 lg:pb-0">
            <PageFade>{children}</PageFade>
          </main>
        </div>

        {/* Mobile (<1024px) only: bottom tab bar. */}
        <HideDuringOnboarding active={onboardingIncomplete}>
          <div className="lg:hidden">
            <BottomNav pendingRequestsCount={pendingRequestsCount} />
          </div>
        </HideDuringOnboarding>
      </div>
    </RequireAuth>
  );
}
