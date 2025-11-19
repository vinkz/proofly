import { redirect } from 'next/navigation';

import { ConfirmationStep } from '../_components/confirmation-step';
import { getProfile } from '@/server/profile';

export default async function ConfirmOnboardingPage() {
  const { profile } = await getProfile();
  const trades = profile?.trade_types ?? [];
  const certs = profile?.certifications ?? [];

  if (!trades.length) {
    redirect('/onboarding/trades');
  }
  if (!certs.length) {
    redirect('/onboarding/certifications');
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-[var(--brand)]">Review your selections</h1>
      <p className="max-w-2xl text-sm text-muted-foreground/80">
        You’re good to go. Finish setup to unlock trade-aware workflows and reporting.
      </p>
      <ConfirmationStep trades={trades} certifications={certs} />
    </div>
  );
}
