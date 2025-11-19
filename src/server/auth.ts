'use server';

import { z } from 'zod';

import { supabaseServerAction, supabaseServerReadOnly } from '@/lib/supabaseServer';
import type { TablesInsert } from '@/lib/database.types';

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const SignUpSchema = CredentialsSchema.extend({
  full_name: z.string().min(2, 'Name is required'),
  date_of_birth: z.string().min(4, 'Date of birth is required'),
  profession: z.string().min(2, 'Profession is required'),
  trade_types: z.array(z.string()).min(1, 'Select at least one trade'),
  certifications: z.array(z.string()).optional().default([]),
});

export async function signInWithPassword(payload: unknown) {
  const body = CredentialsSchema.parse(payload);
  const sb = await supabaseServerAction();
  const { error } = await sb.auth.signInWithPassword({
    email: body.email,
    password: body.password,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function signInWithMagicLink(email: string) {
  const parsed = z.string().email().parse(email);
  const sb = await supabaseServerAction();
  const { error } = await sb.auth.signInWithOtp({
    email: parsed,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/api/auth/callback` || undefined },
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function signUpWithPassword(payload: unknown) {
  const body = SignUpSchema.parse(payload);
  const sb = await supabaseServerAction();

  const { data, error } = await sb.auth.signUp({
    email: body.email,
    password: body.password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/api/auth/callback` || undefined,
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
