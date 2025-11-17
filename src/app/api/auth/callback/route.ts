import { NextResponse } from 'next/server';

import { supabaseServerAction } from '@/lib/supabaseServer';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const supabase = await supabaseServerAction();

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL('/dashboard', url.origin));
}
