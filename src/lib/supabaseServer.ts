import 'server-only';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient, User } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import { env, assertSupabaseEnv } from '@/lib/env';

export function isInvalidRefreshTokenError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /invalid refresh token|refresh token not found/i.test(message);
}

export function isMissingAuthSessionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /auth session missing/i.test(message);
}

export async function getSupabaseUser(
  supabase: Pick<SupabaseClient<Database>, 'auth'>,
): Promise<User | null> {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      if (isInvalidRefreshTokenError(error) || isMissingAuthSessionError(error)) return null;
      throw error;
    }

    return user ?? null;
  } catch (error) {
    if (isInvalidRefreshTokenError(error) || isMissingAuthSessionError(error)) return null;
    throw error;
  }
}

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
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // In RSC/route contexts where mutation is disallowed, silently skip.
          }
        },
        remove(name: string, options) {
          try {
            cookieStore.set({ name, value: '', expires: new Date(0), ...options });
          } catch {
            // In RSC/route contexts where mutation is disallowed, silently skip.
          }
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
