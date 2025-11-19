import { redirect } from 'next/navigation';

import { TradeStep } from '../_components/trade-step';
import { getProfile } from '@/server/profile';

export default async function TradeSelectionPage() {
  const { profile } = await getProfile();
  const initialTrades = profile?.trade_types ?? [];
  const initialCerts = profile?.certifications ?? [];

  if (initialTrades.length && initialCerts.length) {
    redirect('/dashboard');
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-[var(--brand)]">Tailor Proofly to your trade</h1>
      <p className="max-w-2xl text-sm text-muted-foreground/80">
        Pick the trades you cover so we can prioritise the right workflows, terminology, and checklists.
      </p>
      <TradeStep initialSelected={initialTrades} />
    </div>
  );
}
