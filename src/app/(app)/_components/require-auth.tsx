import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { supabaseServerReadOnly } from '@/lib/supabaseServer';

export default async function RequireAuth({ children }: { children: ReactNode }) {
  const supabase = await supabaseServerReadOnly();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const selectVariants = [
    'trade_types, certifications, onboarding_complete',
    'trade_types, certifications',
  ];

  let profile: Record<string, unknown> | null = null;

  for (const columns of selectVariants) {
    const response = await supabase.from('profiles').select(columns).eq('id', user.id).maybeSingle();
    if (response.error) {
      if (response.error.code === '42703') continue;
      throw new Error(response.error.message);
    }
    profile = response.data as Record<string, unknown> | null;
    break;
  }

  const onboardingComplete = (profile as { onboarding_complete?: boolean | null } | null)?.onboarding_complete ?? null;
  const needsOnboarding = onboardingComplete !== true;

  if (needsOnboarding) {
    // /jobs/scan stays protected: enforce onboarding like other app routes.
    redirect('/signup/step1');
  }

  return <>{children}</>;
}
