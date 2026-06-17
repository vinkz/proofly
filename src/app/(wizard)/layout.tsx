import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getSupabaseUser, supabaseServerReadOnly } from '@/lib/supabaseServer';
import { PageFade } from '@/app/(app)/_components/page-fade';

export default async function WizardLayout({ children }: { children: ReactNode }) {
  const supabase = await supabaseServerReadOnly();
  const user = await getSupabaseUser(supabase);

  if (!user) {
    redirect('/login');
  }

  // Focused flow: no global nav (no sidebar, no menu) at any size — just a thin brand header that
  // links home and a Close, so the task fills the screen. The wizard pages render their own in-step
  // "← Back" header (see components/certificates/wizard-layout.tsx, sticky top-14), which is why
  // this header stays h-14.
  return (
    <div className="min-h-screen bg-[var(--color-background-secondary)] font-sans text-[var(--color-text-primary)]">
      <header className="sticky top-0 z-30 h-14 border-b-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
        <div className="flex h-full items-center justify-between gap-4 px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-xl font-extrabold tracking-tight text-[var(--brand)]">certnow</span>
            <span className="hidden text-[13px] text-[var(--color-text-tertiary)] sm:inline">Field compliance</span>
          </Link>
          <Link
            href="/dashboard"
            aria-label="Close and return to dashboard"
            className="flex h-8 w-8 items-center justify-center rounded-full border-[0.5px] border-[var(--color-border-secondary)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-background-tertiary)]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </Link>
        </div>
      </header>

      <main className="px-4 pb-8 pt-6 md:px-10">
        <PageFade>{children}</PageFade>
      </main>
    </div>
  );
}
