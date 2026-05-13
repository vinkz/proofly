'use server';

import { randomUUID } from 'crypto';
import { z } from 'zod';

import { supabaseServerAction, supabaseServerServiceRole } from '@/lib/supabaseServer';
import { TRADE_TYPES } from '@/lib/profile-options';
import {
  ENGINEER_ID_CARD_NUMBER_MESSAGE,
  ENGINEER_ID_CARD_NUMBER_PATTERN,
  GAS_SAFE_NUMBER_MESSAGE,
  GAS_SAFE_NUMBER_PATTERN,
} from '@/lib/onboarding-profile';
import type { TablesInsert } from '@/lib/database.types';

const defaultTrades = TRADE_TYPES as unknown as string[];
const LEGACY_LONG_REQUEST_SLUG_PATTERN = /^cn-[a-f0-9]{20,}$/i;

const SignupWizardSchema = z.object({
  email: z.string().email({ message: 'Valid email required' }),
  password: z.string().optional().default(''),
  auth_provider: z.enum(['password', 'google']).optional().default('password'),
  full_name: z.string().min(2, 'Full name is required'),
  date_of_birth: z.string().min(4, 'Date of birth required'),
  profession: z.string().min(2, 'Profession required'),
  business_name: z.string().optional(),
  company_name: z.string().min(2, 'Company name required'),
  company_address: z.string().min(4, 'Company address required'),
  company_postcode: z.string().min(3, 'Company postcode required'),
  company_phone: z.string().min(6, 'Company phone required'),
  default_engineer_name: z.string().min(2, 'Engineer name required'),
  default_engineer_id: z.string().trim().regex(ENGINEER_ID_CARD_NUMBER_PATTERN, ENGINEER_ID_CARD_NUMBER_MESSAGE),
  gas_safe_number: z.string().trim().regex(GAS_SAFE_NUMBER_PATTERN, GAS_SAFE_NUMBER_MESSAGE),
  trade_types: z
    .array(z.string())
    .default(defaultTrades)
    .transform((value) => (value.length ? value : defaultTrades)),
  certifications: z.array(z.string()).optional().default([]),
});

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);

const buildSignupRequestSlug = (body: z.infer<typeof SignupWizardSchema>, suffix = '') => {
  const gasSafeNumber = body.gas_safe_number.replace(/\D/g, '');
  if (gasSafeNumber.length === 6) return `cn-${gasSafeNumber}${suffix}`;

  const seed = slugify(body.company_name || body.default_engineer_name || body.full_name) || 'engineer';
  return `cn-${seed}-${randomUUID().replace(/-/g, '').slice(0, 6)}`;
};

async function getAvailableRequestSlug(
  profileSb: Awaited<ReturnType<typeof supabaseServerServiceRole>>,
  userId: string,
  body: z.infer<typeof SignupWizardSchema>,
  existingSlug: string,
) {
  if (existingSlug && !LEGACY_LONG_REQUEST_SLUG_PATTERN.test(existingSlug)) return existingSlug;

  const candidates = [
    buildSignupRequestSlug(body),
    buildSignupRequestSlug(body, `-${randomUUID().replace(/-/g, '').slice(0, 4)}`),
    `cn-${randomUUID().replace(/-/g, '').slice(0, 8)}`,
  ];

  for (const candidate of candidates) {
    const { data, error } = await profileSb
      .from('profiles')
      .select('id')
      .eq('request_link_slug', candidate)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data?.id || data.id === userId) return candidate;
  }

  return `cn-${randomUUID().replace(/-/g, '').slice(0, 10)}`;
}

export async function completeSignupWizard(payload: unknown) {
  const body = SignupWizardSchema.parse(payload);
  const sb = await supabaseServerAction();
  const {
    data: { user: existingUser },
  } = await sb.auth.getUser();

  let userId = existingUser?.id ?? null;

  if (!userId) {
    if (!body.password || body.password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    const { data, error } = await sb.auth.signUp({
      email: body.email,
      password: body.password,
      options: {
        data: {
          full_name: body.full_name,
          profession: body.profession,
          business_name: body.company_name ?? body.business_name ?? null,
          trade_types: body.trade_types,
          certifications: body.certifications,
          company_address: body.company_address ?? null,
          company_postcode: body.company_postcode ?? null,
          company_phone: body.company_phone ?? null,
          gas_safe_number: body.gas_safe_number ?? null,
          default_engineer_id: body.default_engineer_id ?? null,
          default_engineer_name: body.default_engineer_name ?? null,
        },
      },
    });
    if (error) throw new Error(error.message);
    userId = data.user?.id ?? null;
  } else {
    const { error } = await sb.auth.updateUser({
      data: {
        full_name: body.full_name,
        profession: body.profession,
        business_name: body.company_name ?? body.business_name ?? null,
        trade_types: body.trade_types,
        certifications: body.certifications,
        company_address: body.company_address ?? null,
        company_postcode: body.company_postcode ?? null,
        company_phone: body.company_phone ?? null,
        gas_safe_number: body.gas_safe_number ?? null,
        default_engineer_id: body.default_engineer_id ?? null,
        default_engineer_name: body.default_engineer_name ?? null,
      },
    });
    if (error) throw new Error(error.message);
  }

  if (!userId) throw new Error('Unable to create user');

  const profileSb = await supabaseServerServiceRole();
  const { data: existingProfile, error: existingProfileErr } = await profileSb
    .from('profiles')
    .select('request_link_slug')
    .eq('id', userId)
    .maybeSingle();
  if (existingProfileErr) throw new Error(existingProfileErr.message);
  const requestLinkSlug = await getAvailableRequestSlug(
    profileSb,
    userId,
    body,
    existingProfile?.request_link_slug?.trim() ?? '',
  );

  const profile: TablesInsert<'profiles'> = {
    id: userId,
    full_name: body.full_name,
    date_of_birth: body.date_of_birth,
    profession: body.profession,
    trade_types: body.trade_types,
    certifications: body.certifications ?? [],
    company_name: body.company_name ?? null,
    company_address: body.company_address ?? null,
    company_postcode: body.company_postcode ?? null,
    company_phone: body.company_phone ?? null,
    default_engineer_name: body.default_engineer_name ?? body.full_name,
    default_engineer_id: body.default_engineer_id ?? null,
    gas_safe_number: body.gas_safe_number ?? null,
    request_link_slug: requestLinkSlug,
    onboarding_complete: true,
  };

  const { error: profileErr } = await profileSb.from('profiles').upsert(profile, { onConflict: 'id' });
  if (profileErr) throw new Error(profileErr.message);

  return { ok: true };
}
