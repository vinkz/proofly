import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

import type { Database } from '@/lib/database.types';
import { env, assertSupabaseEnv } from '@/lib/env';

export async function GET(request: Request) {
  assertSupabaseEnv();
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const cookieStore = cookies();

  const supabase = createServerClient<Database>(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options) {
          cookieStore.set({ name, value: '', expires: new Date(0), ...options });
        },
      },
    },
  );

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL('/jobs', request.url));
}
