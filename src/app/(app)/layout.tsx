import type { ReactNode } from 'react';
import Link from 'next/link';

import RequireAuth from './_components/require-auth';
import { PageFade } from './_components/page-fade';
import { BottomNav } from '@/components/dashboard/bottom-nav';
import { ToolsMenu } from '@/components/dashboard/tools-menu';
import { listPendingJobRequestsForDashboard } from '@/server/job-requests';

export default async function AppLayout({ children }: { children: ReactNode }) {
  let pendingRequestsCount = 0;
  try {
    const requests = await listPendingJobRequestsForDashboard();
    pendingRequestsCount = requests.length;
  } catch {
    pendingRequestsCount = 0;
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
            <ToolsMenu />
          </div>
        </header>

        <main className="pb-14">
          <PageFade>{children}</PageFade>
        </main>

        <BottomNav pendingRequestsCount={pendingRequestsCount} />
      </div>
    </RequireAuth>
  );
}
