'use server';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';

import type { TablesInsert, Database } from '@/lib/database.types';
import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { env, assertSupabaseEnv } from '@/lib/env';
import { TRADE_TYPES } from '@/lib/profile-options';

const defaultTrades = TRADE_TYPES as unknown as string[];

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const SignUpSchema = CredentialsSchema.extend({
  full_name: z.string().min(2, 'Name is required'),
  date_of_birth: z.string().min(4, 'Date of birth is required'),
  profession: z.string().min(2, 'Profession is required'),
  business_name: z.string().optional(),
  trade_types: z
    .array(z.string())
    .default(defaultTrades)
    .transform((value) => (value.length ? value : defaultTrades)),
  certifications: z.array(z.string()).optional().default([]),
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
  const body = SignUpSchema.parse(payload);
  const sb = await createAuthedSupabaseClient();

  const { data, error } = await sb.auth.signUp({
    email: body.email,
    password: body.password,
    options: {
      data: {
        full_name: body.full_name,
        profession: body.profession,
        business_name: body.business_name ?? null,
        trade_types: body.trade_types,
        certifications: body.certifications,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/auth/callback` || undefined,
    },
  });
  if (error) throw new Error(error.message);
  const userId = data.user?.id;
  if (!userId) throw new Error('Unable to create user');

  const profile: TablesInsert<'profiles'> = {
    id: userId,
    full_name: body.full_name,
    date_of_birth: body.date_of_birth,
    profession: body.profession,
    trade_types: body.trade_types,
    certifications: body.certifications ?? [],
    onboarding_complete: true,
  };

  const { error: profileErr } = await sb.from('profiles').upsert(profile, { onConflict: 'id' });
  if (profileErr) throw new Error(profileErr.message);

  return { ok: true };
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
