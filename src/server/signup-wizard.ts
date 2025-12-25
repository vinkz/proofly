'use server';

import { z } from 'zod';

import { supabaseServerAction } from '@/lib/supabaseServer';
import { TRADE_TYPES } from '@/lib/profile-options';
import type { TablesInsert } from '@/lib/database.types';

const defaultTrades = TRADE_TYPES as unknown as string[];

const SignupWizardSchema = z.object({
  email: z.string().email({ message: 'Valid email required' }),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  full_name: z.string().min(2, 'Full name is required'),
  date_of_birth: z.string().min(4, 'Date of birth required'),
  profession: z.string().min(2, 'Profession required'),
  business_name: z.string().optional(),
  trade_types: z
    .array(z.string())
    .default(defaultTrades)
    .transform((value) => (value.length ? value : defaultTrades)),
  certifications: z.array(z.string()).optional().default([]),
});

export async function completeSignupWizard(payload: unknown) {
  const body = SignupWizardSchema.parse(payload);
  const sb = await supabaseServerAction();

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
