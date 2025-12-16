import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

import type { Database } from '@/lib/database.types';
import { env, assertSupabaseEnv } from '@/lib/env';

export async function supabaseServerReadOnly() {
  assertSupabaseEnv();
  const cookieStore = await cookies();
  return createServerClient<Database>(
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {
          return;
        },
        remove() {
          return;
        },
      },
    },
  );
}

export async function supabaseServerAction() {
  assertSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY,
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
}

export async function supabaseServerServiceRole() {
  assertSupabaseEnv();
  const cookieStore = await cookies();
  return createServerClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set() {
        return;
      },
      remove() {
        return;
      },
    },
  });
}
