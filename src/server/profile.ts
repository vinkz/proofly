'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { supabaseServerAction, supabaseServerReadOnly } from '@/lib/supabaseServer';
import { isOnboardingProfileComplete, type OnboardingProfileShape } from '@/lib/onboarding-profile';
import { CERTIFICATIONS, TRADE_TYPES } from '@/lib/profile-options';
import type { Tables } from '@/lib/database.types';

const TradeSchema = z.array(z.enum(TRADE_TYPES)).min(1, 'Select at least one trade');
const CertSchema = z.array(z.enum(CERTIFICATIONS)).min(1, 'Select at least one certification');

const getMissingColumnFromSchemaError = (message: string) =>
  message.match(/Could not find the '([^']+)' column/i)?.[1] ?? null;

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
  const optionalColumns = new Set([
    'onboarding_complete',
    'company_address_line2',
    'company_town',
    'bank_name',
    'bank_account_name',
    'bank_sort_code',
    'bank_account_number',
  ]);
  const workingPatch = { ...patch } as Record<string, unknown>;

  while (true) {
    const { error } = await sb.from('profiles').upsert({ id: userId, ...workingPatch }, { onConflict: 'id' });
    if (!error) return;

    const missingColumn = getMissingColumnFromSchemaError(error.message);

    if (missingColumn && optionalColumns.has(missingColumn) && missingColumn in workingPatch) {
      delete workingPatch[missingColumn];
      continue;
    }

    if (missingColumn === 'onboarding_complete' && 'onboarding_complete' in workingPatch) {
      delete workingPatch.onboarding_complete;
      continue;
    }

    throw new Error(error.message);
  }
}

export async function getProfile() {
  const { sb, user } = await requireUser();
  const selectVariants = [
    'id, full_name, date_of_birth, profession, trade_types, certifications, onboarding_complete, company_name, company_address, company_address_line2, company_town, company_postcode, company_phone, default_engineer_name, default_engineer_id, gas_safe_number, bank_name, bank_account_name, bank_sort_code, bank_account_number',
    'id, full_name, profession, trade_types, certifications, company_name, company_address, company_address_line2, company_town, company_postcode, company_phone, default_engineer_name, default_engineer_id, gas_safe_number, bank_name, bank_account_name, bank_sort_code, bank_account_number',
    'id, full_name, date_of_birth, profession, trade_types, certifications, onboarding_complete, company_name, company_address, company_address_line2, company_town, company_postcode, company_phone, default_engineer_name, default_engineer_id, gas_safe_number',
    'id, full_name, profession, trade_types, certifications, company_name, company_address, company_postcode, company_phone',
  ];

  let data: Tables<'profiles'> | null = null;
  let lastErr: Error | null = null;

  for (const columns of selectVariants) {
    const { data: row, error } = await sb.from('profiles').select(columns).eq('id', user.id).maybeSingle();
    if (error) {
      if (getMissingColumnFromSchemaError(error.message) || error.code === '42703') {
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
  const { data, error } = await sb
    .from('profiles')
    .select(
      'full_name, date_of_birth, profession, company_name, company_address, company_postcode, company_phone, default_engineer_name, default_engineer_id, gas_safe_number',
    )
    .eq('id', user.id)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') throw new Error(error.message);

  await upsertProfile(sb, user.id, {
    onboarding_complete: isOnboardingProfileComplete(data as Partial<OnboardingProfileShape> | null),
  });
  revalidatePath('/dashboard');
  revalidatePath('/templates');
  revalidatePath('/jobs');
  revalidatePath('/onboarding');
}

export async function updateProfileBasics(payload: {
  full_name?: string;
  date_of_birth?: string;
  profession?: string;
  company_name?: string;
  company_address?: string;
  company_address_line2?: string;
  company_town?: string;
  company_postcode?: string;
  company_phone?: string;
  default_engineer_name?: string;
  default_engineer_id?: string;
  gas_safe_number?: string;
  bank_name?: string;
  bank_account_name?: string;
  bank_sort_code?: string;
  bank_account_number?: string;
}) {
  const hasOwn = (key: string) => Object.prototype.hasOwnProperty.call(payload, key);
  const schema = z
    .object({
      full_name: z.string().min(2).optional(),
      date_of_birth: z.string().min(4).optional(),
      profession: z.string().min(2).optional(),
      company_name: z.string().min(2).optional(),
      company_address: z.string().min(4).optional(),
      company_address_line2: z.string().min(2).optional(),
      company_town: z.string().min(2).optional(),
      company_postcode: z.string().min(3).optional(),
      company_phone: z.string().min(6).optional(),
      default_engineer_name: z.string().min(2).optional(),
      default_engineer_id: z.string().min(2).optional(),
      gas_safe_number: z.string().min(2).optional(),
      bank_name: z.string().min(2).optional(),
      bank_account_name: z.string().min(2).optional(),
      bank_sort_code: z.string().min(6).optional(),
      bank_account_number: z.string().min(6).optional(),
    })
    .transform((data) => ({
      full_name: data.full_name?.trim(),
      date_of_birth: data.date_of_birth?.trim() || undefined,
      profession: data.profession?.trim(),
      company_name: data.company_name?.trim(),
      company_address: data.company_address?.trim(),
      company_address_line2: data.company_address_line2?.trim(),
      company_town: data.company_town?.trim(),
      company_postcode: data.company_postcode?.trim(),
      company_phone: data.company_phone?.trim(),
      default_engineer_name: data.default_engineer_name?.trim(),
      default_engineer_id: data.default_engineer_id?.trim(),
      gas_safe_number: data.gas_safe_number?.trim(),
      bank_name: data.bank_name?.trim(),
      bank_account_name: data.bank_account_name?.trim(),
      bank_sort_code: data.bank_sort_code?.trim(),
      bank_account_number: data.bank_account_number?.trim(),
    }));
  const parsed = schema.parse(payload);
  const { sb, user } = await requireUser({ write: true });

  const { data: currentProfile, error: currentProfileError } = await sb
    .from('profiles')
    .select(
      'full_name, date_of_birth, profession, company_name, company_address, company_postcode, company_phone, default_engineer_name, default_engineer_id, gas_safe_number',
    )
    .eq('id', user.id)
    .maybeSingle();
  if (currentProfileError && currentProfileError.code !== 'PGRST116') {
    throw new Error(currentProfileError.message);
  }

  const profilePatch: Partial<Tables<'profiles'>> & { id?: string } = {};
  if (hasOwn('full_name')) profilePatch.full_name = parsed.full_name ?? null;
  if (hasOwn('date_of_birth')) profilePatch.date_of_birth = parsed.date_of_birth ?? null;
  if (hasOwn('profession')) profilePatch.profession = parsed.profession ?? null;
  if (hasOwn('company_name')) profilePatch.company_name = parsed.company_name ?? null;
  if (hasOwn('company_address')) profilePatch.company_address = parsed.company_address ?? null;
  if (hasOwn('company_postcode')) profilePatch.company_postcode = parsed.company_postcode ?? null;
  if (hasOwn('company_phone')) profilePatch.company_phone = parsed.company_phone ?? null;
  if (hasOwn('default_engineer_name')) profilePatch.default_engineer_name = parsed.default_engineer_name ?? null;
  if (hasOwn('default_engineer_id')) profilePatch.default_engineer_id = parsed.default_engineer_id ?? null;
  if (hasOwn('gas_safe_number')) profilePatch.gas_safe_number = parsed.gas_safe_number ?? null;
  if (hasOwn('bank_name')) profilePatch.bank_name = parsed.bank_name ?? null;
  if (hasOwn('bank_account_name')) profilePatch.bank_account_name = parsed.bank_account_name ?? null;
  if (hasOwn('bank_sort_code')) profilePatch.bank_sort_code = parsed.bank_sort_code ?? null;
  if (hasOwn('bank_account_number')) profilePatch.bank_account_number = parsed.bank_account_number ?? null;
  const extendedPatch = profilePatch as Record<string, unknown>;
  if (hasOwn('company_address_line2')) {
    extendedPatch.company_address_line2 = parsed.company_address_line2 ?? null;
  }
  if (hasOwn('company_town')) {
    extendedPatch.company_town = parsed.company_town ?? null;
  }
  const mergedForCompleteness: Partial<OnboardingProfileShape> = {
    ...(currentProfile as Partial<OnboardingProfileShape> | null | undefined),
    ...(hasOwn('full_name') ? { full_name: profilePatch.full_name ?? null } : {}),
    ...(hasOwn('date_of_birth') ? { date_of_birth: profilePatch.date_of_birth ?? null } : {}),
    ...(hasOwn('profession') ? { profession: profilePatch.profession ?? null } : {}),
    ...(hasOwn('company_name') ? { company_name: profilePatch.company_name ?? null } : {}),
    ...(hasOwn('company_address') ? { company_address: profilePatch.company_address ?? null } : {}),
    ...(hasOwn('company_postcode') ? { company_postcode: profilePatch.company_postcode ?? null } : {}),
    ...(hasOwn('company_phone') ? { company_phone: profilePatch.company_phone ?? null } : {}),
    ...(hasOwn('default_engineer_name')
      ? { default_engineer_name: profilePatch.default_engineer_name ?? null }
      : {}),
    ...(hasOwn('default_engineer_id') ? { default_engineer_id: profilePatch.default_engineer_id ?? null } : {}),
    ...(hasOwn('gas_safe_number') ? { gas_safe_number: profilePatch.gas_safe_number ?? null } : {}),
  };
  extendedPatch.onboarding_complete = isOnboardingProfileComplete(mergedForCompleteness);
  await upsertProfile(sb, user.id, extendedPatch as Partial<Tables<'profiles'>> & { id?: string });
  revalidatePath('/dashboard');
  revalidatePath('/settings');
  revalidatePath('/onboarding');
}
