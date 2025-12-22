'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { supabaseServerAction, supabaseServerReadOnly } from '@/lib/supabaseServer';
import { CERTIFICATIONS, TRADE_TYPES } from '@/lib/profile-options';
import type { Tables } from '@/lib/database.types';

const TradeSchema = z.array(z.enum(TRADE_TYPES)).min(1, 'Select at least one trade');
const CertSchema = z.array(z.enum(CERTIFICATIONS)).min(1, 'Select at least one certification');

async function requireUser(options: { write?: boolean } = {}) {
  const sb = options.write ? await supabaseServerAction() : await supabaseServerReadOnly();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');
  return { sb, user };
}

async function upsertProfile(
  sb: Awaited<ReturnType<typeof supabaseServerAction>>,
  userId: string,
  patch: Partial<Tables<'profiles'>> & { id?: string },
) {
  const { error } = await sb.from('profiles').upsert({ id: userId, ...patch }, { onConflict: 'id' });
  if (error?.code === '42703' && 'onboarding_complete' in patch) {
    const rest = { ...patch };
    delete rest.onboarding_complete;
    const retry = await sb.from('profiles').upsert({ id: userId, ...rest }, { onConflict: 'id' });
    if (retry.error) throw new Error(retry.error.message);
    return;
  }
  if (error) throw new Error(error.message);
}

export async function getProfile() {
  const { sb, user } = await requireUser();
  const selectVariants = [
    'id, full_name, date_of_birth, profession, trade_types, certifications, onboarding_complete',
    'id, full_name, profession, trade_types, certifications',
  ];

  let data: Tables<'profiles'> | null = null;
  let lastErr: Error | null = null;

  for (const columns of selectVariants) {
    const { data: row, error } = await sb.from('profiles').select(columns).eq('id', user.id).maybeSingle();
    if (error) {
      if (error.code === '42703') {
        lastErr = new Error(error.message);
        continue;
      }
      throw new Error(error.message);
    }
    data = row as Tables<'profiles'> | null;
    break;
  }

  if (!data && lastErr) {
    throw lastErr;
  }

  return {
    user,
    profile: data ?? null,
  };
}

export async function updateTradeTypes(trades: string[]) {
  const parsed = TradeSchema.parse(trades);
  const { sb, user } = await requireUser({ write: true });
  await upsertProfile(sb, user.id, { trade_types: parsed });
  revalidatePath('/dashboard');
  revalidatePath('/templates');
  revalidatePath('/jobs');
}

export async function updateCertifications(certs: string[]) {
  const parsed = CertSchema.parse(certs);
  const { sb, user } = await requireUser({ write: true });
  await upsertProfile(sb, user.id, { certifications: parsed });
  revalidatePath('/dashboard');
  revalidatePath('/templates');
  revalidatePath('/jobs');
}

export async function markOnboardingComplete() {
  const { sb, user } = await requireUser({ write: true });
  // Ensure the profile row exists even if only one step has been completed.
  await upsertProfile(sb, user.id, { onboarding_complete: true });
  revalidatePath('/dashboard');
  revalidatePath('/templates');
  revalidatePath('/jobs');
}

export async function updateProfileBasics(payload: {
  full_name?: string;
  date_of_birth?: string;
  profession?: string;
}) {
  const schema = z
    .object({
      full_name: z.string().min(2).optional(),
      date_of_birth: z.string().min(4).optional(),
      profession: z.string().min(2).optional(),
    })
    .transform((data) => ({
      full_name: data.full_name?.trim(),
      date_of_birth: data.date_of_birth?.trim() || undefined,
      profession: data.profession?.trim(),
    }));
  const parsed = schema.parse(payload);
  const { sb, user } = await requireUser({ write: true });
  await upsertProfile(sb, user.id, {
    full_name: parsed.full_name ?? null,
    date_of_birth: parsed.date_of_birth ?? null,
    profession: parsed.profession ?? null,
  });
  revalidatePath('/dashboard');
}
