import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';

import { supabaseServerReadOnly } from '@/lib/supabaseServer';

export default async function RequireAuth({ children }: { children: ReactNode }) {
  const headerList = await headers();
  const pathHint =
    [
      'x-invoke-path',
      'x-matched-path',
      'x-original-uri',
      'x-original-url',
      'x-rewrite-url',
      'x-forwarded-uri',
      'x-forwarded-path',
      'x-url',
      'next-url',
      'x-next-url',
      'referer',
    ]
      .map((key) => headerList.get(key))
      .find(Boolean) || '';
  const supabase = await supabaseServerReadOnly();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const selectVariants = [
    'trade_types, certifications, onboarding_complete, company_name, company_address, company_postcode, company_phone, default_engineer_name, default_engineer_id, gas_safe_number',
    'trade_types, certifications, onboarding_complete',
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
  const requiredProfile = [
    (profile as { company_name?: string | null })?.company_name,
    (profile as { company_address?: string | null })?.company_address,
    (profile as { company_postcode?: string | null })?.company_postcode,
    (profile as { company_phone?: string | null })?.company_phone,
    (profile as { default_engineer_name?: string | null })?.default_engineer_name,
    (profile as { default_engineer_id?: string | null })?.default_engineer_id,
    (profile as { gas_safe_number?: string | null })?.gas_safe_number,
  ];
  const missingRequired = requiredProfile.some((val) => !val || !`${val}`.trim());
  const needsOnboarding = onboardingComplete !== true || missingRequired;

  if (needsOnboarding) {
    const isSettings = pathHint.includes('/settings');
    // Avoid redirect loops when we can't detect the current path.
    if (!isSettings && pathHint) {
      redirect('/settings');
    }
  }

  return <>{children}</>;
}
