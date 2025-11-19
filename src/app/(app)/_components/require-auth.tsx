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
  let profileError: { code?: string; message: string } | null = null;

  for (const columns of selectVariants) {
    const response = await supabase.from('profiles').select(columns).eq('id', user.id).maybeSingle();
    if (response.error) {
      profileError = response.error;
      if (response.error.code === '42703') continue;
      throw new Error(response.error.message);
    }
    profile = response.data as Record<string, unknown> | null;
    break;
  }

  const tradeTypes = (profile as { trade_types?: string[] } | null)?.trade_types ?? [];
  const certifications = (profile as { certifications?: string[] } | null)?.certifications ?? [];
  const onboardingComplete = (profile as { onboarding_complete?: boolean | null } | null)?.onboarding_complete ?? null;
  const needsOnboarding =
    onboardingComplete !== true && (tradeTypes.length === 0 || certifications.length === 0);

  if (needsOnboarding) {
    redirect('/onboarding/trades');
  }

  return <>{children}</>;
}
