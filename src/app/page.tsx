import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getSupabaseUser, supabaseServerReadOnly } from '@/lib/supabaseServer';
import { LandingTabs } from './_components/landing-tabs';
import { MarketingFooter, MarketingHeader } from './_components/marketing-chrome';

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
      <MarketingHeader />

      {/* Tabs + content — client component */}
      <LandingTabs />

      <MarketingFooter />
    </div>
  );
}
