'use client';

import { CERTIFICATIONS } from '@/lib/profile-options';
import { updateCertifications } from '@/server/profile';
import { SelectionStep } from './selection-step';

export function CertificationStep({ initialSelected = [] }: { initialSelected?: string[] }) {
  return (
    <SelectionStep
      badge="Step 2 of 3"
      title="Which certifications do you hold?"
      subtitle="We surface trade-appropriate templates and wording based on your credentials."
      options={CERTIFICATIONS as unknown as string[]}
      initialSelected={initialSelected}
      onSubmit={updateCertifications}
      nextHref="/onboarding/confirm"
    />
  );
}
