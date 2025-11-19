import { NextResponse } from 'next/server';

import { supabaseServerAction } from '@/lib/supabaseServer';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const supabase = await supabaseServerAction();

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.redirect(new URL('/login', url.origin));
  }

  const selectVariants = [
    'trade_types, certifications, onboarding_complete',
    'trade_types, certifications',
  ];

  let profile: Record<string, unknown> | null = null;
  for (const columns of selectVariants) {
    const { data, error } = await supabase.from('profiles').select(columns).eq('id', user.id).maybeSingle();
    if (error) {
      if (error.code === '42703') continue;
      break;
    }
    profile = data as unknown as Record<string, unknown>;
    break;
  }

  const trades = (profile as { trade_types?: string[] } | null)?.trade_types ?? [];
  const certs = (profile as { certifications?: string[] } | null)?.certifications ?? [];
  const onboardingComplete = (profile as { onboarding_complete?: boolean | null } | null)?.onboarding_complete ?? null;

  const needsOnboarding = onboardingComplete !== true && (trades.length === 0 || certs.length === 0);
  const destination = needsOnboarding ? '/onboarding/trades' : '/dashboard';

  return NextResponse.redirect(new URL(destination, url.origin));
}
