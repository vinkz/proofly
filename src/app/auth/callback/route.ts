import { NextResponse } from 'next/server';

import { isOnboardingProfileComplete } from '@/lib/onboarding-profile';
import { supabaseServerAction } from '@/lib/supabaseServer';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { searchParams } = url;
  const code = searchParams.get('code');
  const next = searchParams.get('next');
  const supabase = await supabaseServerAction();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const loginUrl = new URL('/login', url.origin);
      loginUrl.searchParams.set('error', 'oauth_callback_failed');
      return NextResponse.redirect(loginUrl);
    }
  }

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return NextResponse.redirect(new URL('/login', url.origin));
  }

  const selectVariants = [
    'trade_types, certifications, onboarding_complete, full_name, date_of_birth, profession, company_name, company_address, company_postcode, company_phone, default_engineer_name, default_engineer_id, gas_safe_number',
    'trade_types, certifications, full_name, date_of_birth, profession, company_name, company_address, company_postcode, company_phone, default_engineer_name, default_engineer_id, gas_safe_number',
    'trade_types, certifications, onboarding_complete',
  ];

  let profile: Record<string, unknown> | null = null;
  for (const columns of selectVariants) {
    const { data, error } = await supabase.from('profiles').select(columns).eq('id', user.id).maybeSingle();
    if (error) {
      if (error.code === '42703') continue;
      break;
    }
    profile = data as Record<string, unknown> | null;
    break;
  }

  const onboardingComplete = (profile as { onboarding_complete?: boolean | null } | null)?.onboarding_complete ?? null;
  const needsOnboarding = onboardingComplete !== true || !isOnboardingProfileComplete(profile as Record<string, unknown>);
  const safeNext = typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : null;
  const destination = needsOnboarding ? '/onboarding' : safeNext ?? '/dashboard';

  return NextResponse.redirect(new URL(destination, url.origin));
}
