import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getSupabaseUser, supabaseServerReadOnly } from '@/lib/supabaseServer';
import { LandingTabs } from './_components/landing-tabs';

export const metadata: Metadata = {
  title: 'certnow | complete CP12s on site',
  description:
    'Digital CP12 workflow for UK gas engineers. Complete the record on site, keep follow-up under control, and leave with a finished PDF ready to send.',
};

export default async function RootPage() {
  const supabase = await supabaseServerReadOnly();
  const user = await getSupabaseUser(supabase);

  if (user) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-[var(--color-background-primary)] text-[var(--color-text-primary)]">
      {/* Nav */}
      <header className="sticky top-0 z-30 h-14 border-b-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
        <div className="flex h-full items-center justify-between px-5">
          <Link href="/">
            <span className="text-xl font-extrabold tracking-tight text-[var(--brand)]">certnow</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="flex h-9 items-center rounded-[20px] border-[0.5px] border-[var(--color-border-primary)] px-4 text-[14px] text-[var(--color-text-secondary)]"
            >
              Log in
            </Link>
            <Link
              href="/signup/step1"
              className="flex h-9 items-center rounded-[20px] bg-[#111] px-4 text-[14px] font-medium text-white"
            >
              Try free
            </Link>
          </div>
        </div>
      </header>

      {/* Tabs + content — client component */}
      <LandingTabs />

      {/* Footer */}
      <footer className="border-t-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-5 py-6">
        <p className="mb-2 text-[15px] font-medium text-[var(--color-text-primary)]">certnow</p>
        <p className="mb-4 text-[13px] leading-[1.6] text-[var(--color-text-tertiary)]">
          Built for Gas Safe engineers in the UK. certnow.uk
        </p>
        <div className="flex gap-5">
          {['Privacy', 'Terms', 'Contact'].map((l) => (
            <Link key={l} href="#" className="text-[13px] text-[var(--color-text-secondary)]">
              {l}
            </Link>
          ))}
        </div>
      </footer>
    </div>
  );
}
