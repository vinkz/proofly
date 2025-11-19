'use client';

import { TRADE_TYPES } from '@/lib/profile-options';
import { updateTradeTypes } from '@/server/profile';
import { SelectionStep } from './selection-step';

export function TradeStep({ initialSelected = [] }: { initialSelected?: string[] }) {
  return (
    <SelectionStep
      badge="Step 1 of 3"
      title="Which trades do you cover?"
      subtitle="We’ll tailor workflows to the trades you choose. Pick everything relevant to your work."
      options={TRADE_TYPES as unknown as string[]}
      initialSelected={initialSelected}
      onSubmit={updateTradeTypes}
      nextHref="/onboarding/certifications"
    />
  );
}
