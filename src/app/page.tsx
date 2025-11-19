import { redirect } from 'next/navigation';

import { supabaseServerReadOnly } from '@/lib/supabaseServer';

export default async function RootPage() {
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
      break;
    }
    profile = response.data as Record<string, unknown> | null;
    break;
  }

  const trades = (profile as { trade_types?: string[] } | null)?.trade_types ?? [];
  const certs = (profile as { certifications?: string[] } | null)?.certifications ?? [];
  const onboardingComplete = (profile as { onboarding_complete?: boolean | null } | null)?.onboarding_complete ?? null;
  const needsOnboarding = onboardingComplete !== true && (trades.length === 0 || certs.length === 0);

  if (needsOnboarding) {
    redirect('/signup/step1');
  }

  redirect('/dashboard');
}
