import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { getOnboardingStep, isOnboardingProfileComplete } from '@/lib/onboarding-profile';
import { getProfile } from '@/server/profile';
import { OnboardingWizard } from './onboarding-wizard';

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<{ step?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const { profile } = await getProfile();

  const onboardingComplete =
    (profile as { onboarding_complete?: boolean | null } | null)?.onboarding_complete ?? null;

  if (onboardingComplete === true && isOnboardingProfileComplete(profile)) {
    redirect('/dashboard');
  }

  const requiredStep = getOnboardingStep(profile);
  const requestedStep = Number(resolvedSearchParams?.step ?? '');
  const initialStep =
    Number.isInteger(requestedStep) && requestedStep >= 1 && requestedStep <= 3
      ? Math.min(requestedStep, requiredStep)
      : requiredStep;

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <h1 className="text-[20px] font-medium text-[var(--color-text-primary)]">Complete your profile</h1>
      <p className="mb-6 mt-1 text-[14px] text-[var(--color-text-secondary)]">
        Work through the essentials now, or save progress and come back later from Settings.
      </p>

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
        initialStep={initialStep}
      />

      <form action="/logout" method="post" className="mt-6 flex justify-center">
        <Button type="submit" variant="ghost" className="text-[13px] text-[var(--color-text-tertiary)]">
          Sign out
        </Button>
      </form>
    </div>
  );
}
