import { redirect } from 'next/navigation';

import { CertificationStep } from '../_components/certification-step';
import { getProfile } from '@/server/profile';

export default async function CertificationSelectionPage() {
  const { profile } = await getProfile();
  const initialTrades = profile?.trade_types ?? [];
  const initialCerts = profile?.certifications ?? [];

  if (initialTrades.length === 0) {
    redirect('/onboarding/trades');
  }

  if (initialTrades.length && initialCerts.length) {
    redirect('/dashboard');
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-[var(--brand)]">Add your certifications</h1>
      <p className="max-w-2xl text-sm text-muted-foreground/80">
        Credentials help us keep your workflows compliant and surface the right paperwork.
      </p>
      <CertificationStep initialSelected={initialCerts} />
    </div>
  );
}
