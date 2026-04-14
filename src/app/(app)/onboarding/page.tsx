import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { isOnboardingProfileComplete } from '@/lib/onboarding-profile';
import { getProfile } from '@/server/profile';
import { OnboardingWizard } from './onboarding-wizard';

export default async function OnboardingPage() {
  const { profile } = await getProfile();

  const onboardingComplete =
    (profile as { onboarding_complete?: boolean | null } | null)?.onboarding_complete ?? null;

  if (onboardingComplete === true && isOnboardingProfileComplete(profile)) {
    redirect('/dashboard');
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-muted">Complete your profile</h1>
        <p className="text-sm text-muted-foreground/70">
          Work through the essentials now, or save progress and come back later from Settings.
        </p>
      </div>

      <OnboardingWizard
        initialFullName={profile?.full_name ?? ''}
        initialDateOfBirth={profile?.date_of_birth ?? ''}
        initialProfession={profile?.profession ?? ''}
        initialCompanyName={profile?.company_name ?? ''}
        initialEngineerId={profile?.default_engineer_id ?? ''}
        initialGasSafeNumber={profile?.gas_safe_number ?? ''}
        initialCompanyAddressLine1={(profile as { company_address?: string | null } | null)?.company_address ?? ''}
        initialCompanyAddressLine2={
          (profile as { company_address_line2?: string | null } | null)?.company_address_line2 ?? ''
        }
        initialCompanyTown={(profile as { company_town?: string | null } | null)?.company_town ?? ''}
        initialCompanyPostcode={(profile as { company_postcode?: string | null } | null)?.company_postcode ?? ''}
        initialCompanyPhone={(profile as { company_phone?: string | null } | null)?.company_phone ?? ''}
      />

      <form action="/logout" method="post" className="flex justify-end">
        <Button type="submit" variant="outline" className="rounded-full">
          Sign out
        </Button>
      </form>
    </div>
  );
}
