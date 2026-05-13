import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';

import { getOnboardingStep, isOnboardingProfileComplete } from '@/lib/onboarding-profile';
import { getSupabaseUser, supabaseServerReadOnly } from '@/lib/supabaseServer';

function getCurrentPathname(requestHeaders: Headers) {
  const directPath = requestHeaders.get('x-current-path');
  if (directPath) return directPath;

  const nextUrl = requestHeaders.get('next-url') ?? requestHeaders.get('x-invoke-path') ?? '';
  if (nextUrl.startsWith('/')) {
    return nextUrl.split('?')[0] || '/';
  }

  const referer = requestHeaders.get('referer');
  if (referer) {
    try {
      return new URL(referer).pathname;
    } catch {
      return '';
    }
  }

  return '';
}

export default async function RequireAuth({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  const pathname = getCurrentPathname(requestHeaders);
  const supabase = await supabaseServerReadOnly();
  const user = await getSupabaseUser(supabase);

  if (!user) {
    redirect('/login');
  }

  const allowIncompleteProfile =
    pathname === '/onboarding' ||
    pathname.startsWith('/onboarding/') ||
    pathname === '/settings' ||
    pathname.startsWith('/settings/');

  if (pathname && !allowIncompleteProfile) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select(
        'onboarding_complete, full_name, date_of_birth, profession, company_name, company_address, company_postcode, company_phone, default_engineer_name, default_engineer_id, gas_safe_number',
      )
      .eq('id', user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw new Error(error.message);
    }

    const complete =
      (profile as { onboarding_complete?: boolean | null } | null)?.onboarding_complete === true &&
      isOnboardingProfileComplete(profile);

    if (!complete) {
      redirect(`/onboarding?step=${getOnboardingStep(profile)}`);
    }
  }

  return <>{children}</>;
}
