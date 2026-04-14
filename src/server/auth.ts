'use server';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';

import type { Database } from '@/lib/database.types';
import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { env, assertSupabaseEnv } from '@/lib/env';

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

async function createAuthedSupabaseClient() {
  assertSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
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
  });
}

export async function signInWithPassword(payload: unknown) {
  const body = CredentialsSchema.parse(payload);
  const sb = await createAuthedSupabaseClient();
  const { error } = await sb.auth.signInWithPassword({
    email: body.email,
    password: body.password,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function signInWithMagicLink(email: string) {
  const parsed = z.string().email().parse(email);
  const sb = await createAuthedSupabaseClient();
  const { error } = await sb.auth.signInWithOtp({
    email: parsed,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/auth/callback` || undefined },
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function signUpWithPassword(payload: unknown) {
  const body = CredentialsSchema.parse(payload);
  const sb = await createAuthedSupabaseClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const emailRedirectTo = siteUrl ? `${siteUrl}/auth/callback?next=${encodeURIComponent('/onboarding')}` : undefined;

  const { data, error } = await sb.auth.signUp({
    email: body.email,
    password: body.password,
    options: {
      emailRedirectTo,
    },
  });
  if (error) throw new Error(error.message);

  return {
    ok: true,
    needsEmailConfirmation: !data.session,
  };
}

export async function userHasPassword() {
  const sb = await supabaseServerReadOnly();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  const identities = (
    user as { identities?: Array<{ provider?: string; identity_data?: Record<string, unknown> }> }
  ).identities;
  const hasPassword = Array.isArray(identities)
    ? identities.some((identity) => identity.provider === 'email' && !!identity.identity_data?.email)
    : false;

  return { user, hasPassword };
}
