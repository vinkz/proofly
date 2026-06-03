'use server';

import { randomUUID } from 'crypto';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

import { isEmailConfigured, sendEmail } from '@/lib/resend';
import {
  baseEmail,
  benefitList,
  ctaButton,
  emailSubtitle,
  emailTitle,
  formatDate,
  infoCard,
  note,
  paragraph,
  titleCase,
} from '@/lib/email-templates';
import { supabaseServerReadOnly, supabaseServerServiceRole, getSupabaseUser } from '@/lib/supabaseServer';

const RequestIdSchema = z.string().uuid();
const ClaimTokenSchema = z.string().uuid();
const LandlordRequestLinkEmailSchema = z.object({
  landlordEmail: z.string().email(),
  landlordName: z.string().max(120).optional().default(''),
});
const StandaloneJobRequestSchema = z.object({
  landlordName: z.string().min(2).max(120),
  landlordEmail: z.string().email(),
  landlordPhone: z.string().min(3).max(80),
  landlordAddressLine1: z.string().max(240).optional().default(''),
  landlordAddressLine2: z.string().max(240).optional().default(''),
  landlordCity: z.string().max(120).optional().default(''),
  landlordPostcode: z.string().max(40).optional().default(''),
  propertyAddress: z.string().min(5).max(500),
  propertyPostcode: z.string().max(40).optional().default(''),
  jobType: z.enum(['cp12', 'service', 'both', 'other']),
  tenantName: z.string().max(120).optional().default(''),
  tenantPhone: z.string().max(80).optional().default(''),
  accessNotes: z.string().max(1000).optional().default(''),
  preferredDates: z.string().max(500).optional().default(''),
  engineerName: z.string().min(2).max(120),
  engineerEmail: z.string().email().optional().or(z.literal('')),
  engineerPhone: z.string().max(80).optional().default(''),
  engineerGasSafeNumber: z.string().max(40).optional().default(''),
  engineerRequestSlug: z.string().max(120).optional().default(''),
});

type UntypedQuery = {
  select: (columns?: string) => UntypedQuery;
  insert: (payload: Record<string, unknown> | Array<Record<string, unknown>>) => UntypedQuery;
  update: (payload: Record<string, unknown>) => UntypedQuery;
  eq: (column: string, value: unknown) => UntypedQuery;
  or: (query: string) => UntypedQuery;
  order: (column: string, options?: { ascending?: boolean }) => UntypedQuery;
  maybeSingle: () => Promise<{ data: unknown; error: { code?: string; message: string } | null }>;
  then: Promise<{ data: unknown; error: { code?: string; message: string } | null }>['then'];
};
type UntypedSupabase = { from: (table: string) => UntypedQuery };
const fromJobRequests = (sb: unknown) => (sb as UntypedSupabase).from('job_requests');

type EngineerProfileMatch = {
  id: string;
  companyName: string | null;
  engineerName: string | null;
  email: string | null;
  phone: string | null;
  gasSafeNumber: string | null;
};

const getSiteUrl = () =>
  (
    process.env.NEXT_PUBLIC_SHARE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    'https://certnow.uk'
  ).replace(/\/$/, '');

const formatJobType = (jobType: string) => {
  if (jobType === 'cp12') return 'Annual gas safety check';
  if (jobType === 'service') return 'Boiler service';
  if (jobType === 'both') return 'Gas safety check and boiler service';
  return 'Other gas compliance work';
};

const cleanText = (value: string | null | undefined) => String(value ?? '').trim();
const normalizeEmailKey = (value: string | null | undefined) => cleanText(value).toLowerCase();
const normalizePhoneDigits = (value: string | null | undefined) => cleanText(value).replace(/\D/g, '');

const getPhoneMatchKeys = (value: string | null | undefined) => {
  const digits = normalizePhoneDigits(value);
  if (digits.length < 6) return new Set<string>();
  const keys = new Set([digits]);
  if (digits.startsWith('44') && digits.length > 2) {
    keys.add(`0${digits.slice(2)}`);
  }
  if (digits.startsWith('0') && digits.length > 1) {
    keys.add(`44${digits.slice(1)}`);
  }
  return keys;
};

const phoneMatches = (left: string | null | undefined, right: string | null | undefined) => {
  const leftKeys = getPhoneMatchKeys(left);
  const rightKeys = getPhoneMatchKeys(right);
  if (!leftKeys.size || !rightKeys.size) return false;
  return [...leftKeys].some((key) => rightKeys.has(key));
};

const normalizeCertTypes = (jobType: string) => {
  if (jobType === 'both') return ['cp12', 'boiler_service'];
  if (jobType === 'service') return ['boiler_service'];
  return ['cp12'];
};

const addDaysIso = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

const LEGACY_LONG_REQUEST_SLUG_PATTERN = /^cn-[a-f0-9]{20,}$/i;

const buildReadableRequestSlug = (input: {
  gasSafeNumber?: string | null;
  companyName?: string | null;
  engineerName?: string | null;
  fullName?: string | null;
  email?: string | null;
}) => {
  const gasSafeNumber = cleanText(input.gasSafeNumber).replace(/\D/g, '');
  if (gasSafeNumber.length === 6) return `cn-${gasSafeNumber}`;

  const seed =
    cleanText(input.companyName) ||
    cleanText(input.engineerName) ||
    cleanText(input.fullName) ||
    cleanText(input.email) ||
    'engineer';
  const readable = slugify(seed).slice(0, 24) || 'engineer';
  return `cn-${readable}-${randomUUID().replace(/-/g, '').slice(0, 6)}`;
};

const persistEngineerRequestSlug = async (
  admin: unknown,
  userId: string,
  preferredSlug: string,
  fallbackInput: Parameters<typeof buildReadableRequestSlug>[0],
) => {
  const attempts = [
    preferredSlug,
    `cn-${slugify(cleanText(fallbackInput.companyName) || cleanText(fallbackInput.engineerName) || 'engineer').slice(0, 18)}-${randomUUID().replace(/-/g, '').slice(0, 6)}`,
    `cn-${randomUUID().replace(/-/g, '').slice(0, 8)}`,
  ];

  for (const slug of attempts) {
    const { error } = await (admin as unknown as UntypedSupabase)
      .from('profiles')
      .update({ request_link_slug: slug })
      .eq('id', userId);
    if (!error) return slug;
    if (error.code !== '23505') throw new Error(error.message);
  }

  throw new Error('Unable to create request link slug');
};

const normalizeProfileMatch = (row: Record<string, unknown> | null | undefined): EngineerProfileMatch | null => {
  if (!row || typeof row.id !== 'string') return null;
  return {
    id: row.id,
    companyName: typeof row.company_name === 'string' ? row.company_name : null,
    engineerName:
      typeof row.default_engineer_name === 'string'
        ? row.default_engineer_name
        : typeof row.full_name === 'string'
          ? row.full_name
          : null,
    email: typeof row.company_email === 'string' ? row.company_email : null,
    phone: typeof row.company_phone === 'string' ? row.company_phone : null,
    gasSafeNumber: typeof row.gas_safe_number === 'string' ? row.gas_safe_number : null,
  };
};

async function findEngineerProfileByColumn(
  sb: unknown,
  column: 'company_email' | 'company_phone' | 'gas_safe_number' | 'request_link_slug',
  value: string,
) {
  if (!value) return null;
  const { data, error } = await (sb as UntypedSupabase)
    .from('profiles')
    .select('id, full_name, default_engineer_name, company_name, company_email, company_phone, gas_safe_number, request_link_slug')
    .eq(column, value)
    .maybeSingle();
  if (error) {
    if (['42P01', '42703', 'PGRST204'].includes(error.code ?? '')) return null;
    throw new Error(error.message);
  }
  return normalizeProfileMatch(data as Record<string, unknown> | null);
}

async function findEngineerProfileByAuthEmail(sb: unknown, email: string) {
  const normalizedEmail = normalizeEmailKey(email);
  if (!normalizedEmail) return null;
  const admin = sb as Awaited<ReturnType<typeof supabaseServerServiceRole>>;
  const { data: users, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) throw new Error(usersError.message);
  const authUser = users.users.find((user) => user.email?.toLowerCase() === normalizedEmail);
  if (!authUser) return null;
  const { data, error } = await (sb as UntypedSupabase)
    .from('profiles')
    .select('id, full_name, default_engineer_name, company_name, company_email, company_phone, gas_safe_number, request_link_slug')
    .eq('id', authUser.id)
    .maybeSingle();
  if (error) {
    if (['42P01', '42703', 'PGRST204'].includes(error.code ?? '')) return null;
    throw new Error(error.message);
  }
  const profile = normalizeProfileMatch(data as Record<string, unknown> | null);
  return profile ? { ...profile, email: profile.email ?? authUser.email ?? null } : null;
}

async function getEngineerAuthEmail(sb: unknown, userId: string) {
  const admin = sb as Awaited<ReturnType<typeof supabaseServerServiceRole>>;
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) return null;
  return data.user?.email ?? null;
}

async function getEngineerNotificationRecipient(
  sb: unknown,
  engineerProfile: EngineerProfileMatch | null,
  fallbackEmail: string,
) {
  if (!engineerProfile) return cleanText(fallbackEmail);
  const profileEmail = cleanText(engineerProfile.email);
  if (profileEmail) return profileEmail;
  const authEmail = cleanText(await getEngineerAuthEmail(sb, engineerProfile.id));
  return authEmail || cleanText(fallbackEmail);
}

async function findEngineerProfileByPhone(sb: unknown, phone: string) {
  const exactMatch = await findEngineerProfileByColumn(sb, 'company_phone', cleanText(phone));
  if (exactMatch) return exactMatch;

  const targetKeys = getPhoneMatchKeys(phone);
  if (!targetKeys.size) return null;

  const { data, error } = await (sb as UntypedSupabase)
    .from('profiles')
    .select('id, full_name, default_engineer_name, company_name, company_email, company_phone, gas_safe_number, request_link_slug');
  if (error) {
    if (['42P01', '42703', 'PGRST204'].includes(error.code ?? '')) return null;
    throw new Error(error.message);
  }

  return ((data ?? []) as Record<string, unknown>[])
    .map(normalizeProfileMatch)
    .find((profile) => profile && phoneMatches(profile.phone, phone)) ?? null;
}

async function findEngineerProfileForRequest(
  sb: unknown,
  request: {
    engineerEmail: string;
    engineerPhone: string;
    engineerGasSafeNumber?: string;
    engineerRequestSlug?: string;
  },
) {
  const slugMatch = await findEngineerProfileByColumn(sb, 'request_link_slug', cleanText(request.engineerRequestSlug));
  if (slugMatch) return slugMatch;

  const emailMatch = await findEngineerProfileByColumn(sb, 'company_email', normalizeEmailKey(request.engineerEmail));
  if (emailMatch) return emailMatch;

  const authEmailMatch = await findEngineerProfileByAuthEmail(sb, request.engineerEmail);
  if (authEmailMatch) return authEmailMatch;

  const gasSafeMatch = await findEngineerProfileByColumn(
    sb,
    'gas_safe_number',
    cleanText(request.engineerGasSafeNumber),
  );
  if (gasSafeMatch) return gasSafeMatch;

  return findEngineerProfileByPhone(sb, request.engineerPhone);
}

async function sendEmailSafely(context: string, input: Parameters<typeof sendEmail>[0]) {
  if (!isEmailConfigured()) return { status: 'not_configured' as const };
  try {
    const result = await sendEmail(input);
    if (result.status !== 'sent') console.error(`[${context}] email failed:`, result.error ?? result.status);
    return result;
  } catch (error) {
    console.error(`[${context}] email failed:`, error);
    return { status: 'failed' as const, error: error instanceof Error ? error.message : 'Unknown email error' };
  }
}

export type DashboardJobRequest = {
  id: string;
  requestType: 'new_job' | 'renewal';
  source: string;
  jobType: string;
  propertyAddress: string | null;
  landlordName: string | null;
  landlordEmail: string | null;
  landlordPhone: string | null;
  landlordAddressLine1: string | null;
  landlordAddressLine2: string | null;
  landlordCity: string | null;
  landlordPostcode: string | null;
  tenantName: string | null;
  tenantPhone: string | null;
  accessNotes: string | null;
  preferredDates: string | null;
  propertyPostcode: string | null;
  engineerName: string | null;
  engineerCompany: string | null;
  engineerEmail: string | null;
  engineerPhone: string | null;
  engineerGasSafeNumber: string | null;
  sourceJobId: string | null;
  createdAt: string | null;
};

export type JobRequestPrefill = {
  id: string;
  requestType: 'new_job' | 'renewal';
  jobType: string;
  landlordName: string;
  landlordEmail: string;
  landlordPhone: string;
  landlordAddressLine1: string;
  landlordAddressLine2: string;
  landlordCity: string;
  landlordPostcode: string;
  propertyAddress: string;
  propertyPostcode: string;
  tenantName: string;
  tenantPhone: string;
  accessNotes: string;
  preferredDates: string;
};

function normalizeRequest(row: Record<string, unknown>): DashboardJobRequest {
  return {
    id: String(row.id ?? ''),
    requestType: row.request_type === 'new_job' ? 'new_job' : 'renewal',
    source: String(row.source ?? 'public_job_page'),
    jobType: String(row.job_type ?? 'cp12'),
    propertyAddress: typeof row.property_address === 'string' ? row.property_address : null,
    landlordName: typeof row.landlord_name === 'string' ? row.landlord_name : null,
    landlordEmail: typeof row.landlord_email === 'string' ? row.landlord_email : null,
    landlordPhone: typeof row.landlord_phone === 'string' ? row.landlord_phone : null,
    landlordAddressLine1: typeof row.landlord_address_line1 === 'string' ? row.landlord_address_line1 : null,
    landlordAddressLine2: typeof row.landlord_address_line2 === 'string' ? row.landlord_address_line2 : null,
    landlordCity: typeof row.landlord_city === 'string' ? row.landlord_city : null,
    landlordPostcode: typeof row.landlord_postcode === 'string' ? row.landlord_postcode : null,
    tenantName: typeof row.tenant_name === 'string' ? row.tenant_name : null,
    tenantPhone: typeof row.tenant_phone === 'string' ? row.tenant_phone : null,
    accessNotes: typeof row.access_notes === 'string' ? row.access_notes : null,
    preferredDates: typeof row.preferred_dates === 'string' ? row.preferred_dates : null,
    propertyPostcode: typeof row.property_postcode === 'string' ? row.property_postcode : null,
    engineerName: typeof row.engineer_name === 'string' ? row.engineer_name : null,
    engineerCompany: typeof row.engineer_company === 'string' ? row.engineer_company : null,
    engineerEmail: typeof row.engineer_email === 'string' ? row.engineer_email : null,
    engineerPhone: typeof row.engineer_phone === 'string' ? row.engineer_phone : null,
    engineerGasSafeNumber: typeof row.engineer_gas_safe_number === 'string' ? row.engineer_gas_safe_number : null,
    sourceJobId: typeof row.source_job_id === 'string' ? row.source_job_id : null,
    createdAt: typeof row.created_at === 'string' ? row.created_at : null,
  };
}

export async function listPendingJobRequestsForDashboard() {
  const readClient = await supabaseServerReadOnly();
  const user = await getSupabaseUser(readClient);
  if (!user) throw new Error('Unauthorized');

  const admin = await supabaseServerServiceRole();
  const userEmail = normalizeEmailKey(user.email);
  const ownershipFilter = [
    `user_id.eq.${user.id}`,
    `assigned_engineer_id.eq.${user.id}`,
    userEmail ? `pending_engineer_email.eq.${userEmail}` : null,
    userEmail ? `engineer_email.eq.${userEmail}` : null,
  ].filter(Boolean).join(',');
  const { data, error } = await fromJobRequests(admin)
    .select('*')
    .or(ownershipFilter)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) {
    if (error.code === '42P01') return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as Record<string, unknown>[]).map(normalizeRequest);
}

export async function dismissJobRequest(requestId: string) {
  const parsed = RequestIdSchema.parse(requestId);
  const readClient = await supabaseServerReadOnly();
  const user = await getSupabaseUser(readClient);
  if (!user) throw new Error('Unauthorized');

  const admin = await supabaseServerServiceRole();
  const userEmail = normalizeEmailKey(user.email);
  const ownershipFilter = [
    `user_id.eq.${user.id}`,
    `assigned_engineer_id.eq.${user.id}`,
    userEmail ? `pending_engineer_email.eq.${userEmail}` : null,
    userEmail ? `engineer_email.eq.${userEmail}` : null,
  ].filter(Boolean).join(',');
  const { error } = await fromJobRequests(admin)
    .update({ status: 'dismissed', updated_at: new Date().toISOString() })
    .eq('id', parsed)
    .or(ownershipFilter);
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function getOrCreateEngineerRequestLink() {
  const readClient = await supabaseServerReadOnly();
  const user = await getSupabaseUser(readClient);
  if (!user) throw new Error('Unauthorized');

  const admin = await supabaseServerServiceRole();
  const { data: profile, error } = await (admin as unknown as UntypedSupabase)
    .from('profiles')
    .select('id, full_name, default_engineer_name, company_name, gas_safe_number, request_link_slug')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const row = (profile ?? {}) as Record<string, unknown>;
  const existingSlug = typeof row.request_link_slug === 'string' ? row.request_link_slug.trim() : '';
  if (existingSlug && !LEGACY_LONG_REQUEST_SLUG_PATTERN.test(existingSlug)) {
    const path = `/request/${existingSlug}`;
    return { slug: existingSlug, path, url: `${getSiteUrl()}${path}` };
  }

  const slugInput = {
    gasSafeNumber: row.gas_safe_number as string | undefined,
    companyName: row.company_name as string | undefined,
    engineerName: row.default_engineer_name as string | undefined,
    fullName: row.full_name as string | undefined,
    email: user.email,
  };
  const slug = await persistEngineerRequestSlug(admin, user.id, buildReadableRequestSlug(slugInput), slugInput);

  revalidatePath('/dashboard');
  revalidatePath('/jobs/new');
  const path = `/request/${slug}`;
  return { slug, path, url: `${getSiteUrl()}${path}` };
}

export async function sendEngineerRequestLinkToLandlord(input: z.input<typeof LandlordRequestLinkEmailSchema>) {
  const parsed = LandlordRequestLinkEmailSchema.parse(input);
  const link = await getOrCreateEngineerRequestLink();
  const readClient = await supabaseServerReadOnly();
  const user = await getSupabaseUser(readClient);
  const admin = await supabaseServerServiceRole();
  const { data: profile } = user
    ? await (admin as unknown as UntypedSupabase)
        .from('profiles')
        .select('default_engineer_name, full_name, company_name, company_email')
        .eq('id', user.id)
        .maybeSingle()
    : { data: null };
  const profileRow = (profile ?? {}) as Record<string, unknown>;
  const engineerName = titleCase(cleanText(profileRow.default_engineer_name as string) || cleanText(profileRow.full_name as string) || user?.email || 'your engineer');
  const companyName = titleCase(cleanText(profileRow.company_name as string) || engineerName);
  const engineerEmail = cleanText(profileRow.company_email as string) || user?.email || undefined;
  const landlordName = cleanText(parsed.landlordName);
  const subject = `${engineerName} wants your property details`;
  const status = (await sendEmailSafely('sendEngineerRequestLinkToLandlord', {
    to: parsed.landlordEmail,
    subject,
    replyTo: engineerEmail,
    text: [
      landlordName ? `Hi ${titleCase(landlordName)},` : 'Hi,',
      '',
      `${engineerName} from ${companyName} is setting up a gas safety job and needs a few details from you.`,
      '',
      `Fill in property details: ${link.url}`,
      '',
      "You'll be asked for property address, tenant contact, and access notes. No account is needed.",
    ].join('\n'),
    html: baseEmail(
      [
        emailTitle('Property details needed'),
        emailSubtitle(`${engineerName} from ${companyName} is setting up a gas safety job and needs a few details from you. It takes under 2 minutes and no account is needed.`),
        ctaButton('Fill in property details', link.url, 'green'),
        note("You'll be asked for: property address, tenant contact, and access notes. That's it."),
      ].join(''),
      { subject, sentOnBehalfOf: engineerName },
    ),
  })).status;

  return { ok: true, status, url: link.url };
}

export async function claimPendingJobRequest(claimToken: string) {
  const parsed = ClaimTokenSchema.parse(claimToken);
  const readClient = await supabaseServerReadOnly();
  const user = await getSupabaseUser(readClient);
  if (!user) throw new Error('Unauthorized');

  const admin = await supabaseServerServiceRole();
  const { data, error } = await fromJobRequests(admin)
    .select('id, status, claim_token_expires_at, claimed_at')
    .eq('claim_token', parsed)
    .maybeSingle();
  if (error) {
    if (error.code === '42P01') throw new Error('Job requests are not configured yet.');
    throw new Error(error.message);
  }
  const request = data as Record<string, unknown> | null;
  if (!request || typeof request.id !== 'string') throw new Error('Request not found');
  if (request.status && request.status !== 'pending') throw new Error('Request is no longer pending');
  if (request.claimed_at) throw new Error('Request has already been claimed');
  const expiresAt = typeof request.claim_token_expires_at === 'string'
    ? new Date(request.claim_token_expires_at).getTime()
    : 0;
  if (!expiresAt || expiresAt < Date.now()) throw new Error('Request claim link has expired');

  const { error: updateErr } = await fromJobRequests(admin)
    .update({
      assigned_engineer_id: user.id,
      user_id: user.id,
      pending_engineer_email: null,
      claimed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', request.id);
  if (updateErr) throw new Error(updateErr.message);

  revalidatePath('/dashboard');
  return { ok: true, requestId: request.id };
}

export async function getEngineerRequestProfileBySlug(slug: string) {
  const parsed = z.string().min(3).max(120).parse(slug).trim();
  const admin = await supabaseServerServiceRole();
  const profile = await findEngineerProfileByColumn(admin, 'request_link_slug', parsed);
  if (!profile) return null;
  return {
    requestLinkSlug: parsed,
    engineerName: profile.engineerName,
    companyName: profile.companyName,
    email: profile.email,
    phone: profile.phone,
    gasSafeNumber: profile.gasSafeNumber,
  };
}

export async function sendJobRequestNotification(requestId: string) {
  const parsed = RequestIdSchema.parse(requestId);
  const readClient = await supabaseServerReadOnly();
  const user = await getSupabaseUser(readClient);
  if (!user) throw new Error('Unauthorized');

  const admin = await supabaseServerServiceRole();
  const { data, error } = await fromJobRequests(admin)
    .select('*')
    .eq('id', parsed)
    .maybeSingle();
  if (error) {
    if (error.code === '42P01') throw new Error('Job requests are not configured yet.');
    throw new Error(error.message);
  }
  if (!data) throw new Error('Request not found');
  const row = data as Record<string, unknown>;
  const assignedEngineerId = typeof row.assigned_engineer_id === 'string' ? row.assigned_engineer_id : null;
  const ownerId = typeof row.user_id === 'string' ? row.user_id : null;
  if (assignedEngineerId !== user.id && ownerId !== user.id) throw new Error('Unauthorized');

  const request = normalizeRequest(row);
  const engineerEmail = normalizeEmailKey(request.engineerEmail);
  const landlordEmail = normalizeEmailKey(request.landlordEmail);
  if (!engineerEmail || engineerEmail === landlordEmail) return { ok: true, status: 'not_configured' as const };

  const href = `${getSiteUrl()}/jobs/new?requestId=${request.id}`;
  const landlordName = titleCase(request.landlordName || 'A landlord');
  const propertyAddress = request.propertyAddress || 'Not provided';
  const subject = `New job request from ${landlordName}`;
  const status = (await sendEmailSafely('sendJobRequestNotification', {
    to: engineerEmail,
    subject,
    text: [
      `${landlordName} has submitted a job request and named you as their engineer.`,
      '',
      `Property: ${propertyAddress}`,
      `Work needed: ${formatJobType(request.jobType)}`,
      `Landlord: ${landlordName}`,
      `Landlord phone: ${request.landlordPhone ?? 'Not provided'}`,
      `Landlord email: ${request.landlordEmail ?? 'Not provided'}`,
      `Tenant: ${request.tenantName || 'Not provided'}`,
      `Access notes: ${request.accessNotes || 'Not provided'}`,
      `Preferred dates: ${request.preferredDates || 'Flexible'}`,
      '',
      `Open request in CertNow: ${href}`,
    ].join('\n'),
    html: baseEmail(
      [
        emailTitle('New job request'),
        emailSubtitle(`${landlordName} has submitted a job request and named you as their engineer.`),
        infoCard('Job details', [
          { label: 'Property', value: propertyAddress },
          { label: 'Work needed', value: formatJobType(request.jobType) },
          { label: 'Landlord', value: landlordName },
          { label: 'Landlord phone', value: request.landlordPhone || 'Not provided' },
          { label: 'Landlord email', value: request.landlordEmail || 'Not provided' },
          { label: 'Tenant', value: request.tenantName || 'Not provided' },
          { label: 'Access notes', value: request.accessNotes || 'Not provided' },
          { label: 'Preferred dates', value: request.preferredDates || 'Flexible' },
        ]),
        ctaButton('Open request in CertNow', href, 'green'),
      ].join(''),
      { subject },
    ),
  })).status;

  const { error: updateErr } = await fromJobRequests(admin)
    .update({
      engineer_notification_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', request.id);
  if (updateErr) throw new Error(updateErr.message);
  return { ok: true, status };
}

export async function getJobRequestPrefill(requestId: string): Promise<JobRequestPrefill | null> {
  const parsed = RequestIdSchema.parse(requestId);
  const readClient = await supabaseServerReadOnly();
  const user = await getSupabaseUser(readClient);
  if (!user) throw new Error('Unauthorized');

  const admin = await supabaseServerServiceRole();
  const { data, error } = await fromJobRequests(admin)
    .select('*')
    .eq('id', parsed)
    .maybeSingle();
  if (error) {
    if (error.code === '42P01') return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const userEmail = normalizeEmailKey(user.email);
  const ownerId = typeof row.user_id === 'string' ? row.user_id : null;
  const assignedEngineerId = typeof row.assigned_engineer_id === 'string' ? row.assigned_engineer_id : null;
  const pendingEngineerEmail = typeof row.pending_engineer_email === 'string' ? normalizeEmailKey(row.pending_engineer_email) : '';
  const engineerEmail = typeof row.engineer_email === 'string' ? normalizeEmailKey(row.engineer_email) : '';
  const canAccess =
    ownerId === user.id ||
    assignedEngineerId === user.id ||
    (!!userEmail && (pendingEngineerEmail === userEmail || engineerEmail === userEmail));
  if (!canAccess) throw new Error('Unauthorized');
  const request = normalizeRequest(row);
  return {
    id: request.id,
    requestType: request.requestType,
    jobType: request.jobType,
    landlordName: request.landlordName ?? '',
    landlordEmail: request.landlordEmail ?? '',
    landlordPhone: request.landlordPhone ?? '',
    landlordAddressLine1: request.landlordAddressLine1 ?? '',
    landlordAddressLine2: request.landlordAddressLine2 ?? '',
    landlordCity: request.landlordCity ?? '',
    landlordPostcode: request.landlordPostcode ?? '',
    propertyAddress: request.propertyAddress ?? '',
    propertyPostcode: request.propertyPostcode ?? '',
    tenantName: request.tenantName ?? '',
    tenantPhone: request.tenantPhone ?? '',
    accessNotes: request.accessNotes ?? '',
    preferredDates: request.preferredDates ?? '',
  };
}

export async function createPendingJobRequest(input: z.input<typeof StandaloneJobRequestSchema>) {
  const parsedRequest = StandaloneJobRequestSchema.parse(input);
  const request = {
    landlordName: cleanText(parsedRequest.landlordName),
    landlordEmail: cleanText(parsedRequest.landlordEmail),
    landlordPhone: cleanText(parsedRequest.landlordPhone),
    landlordAddressLine1: cleanText(parsedRequest.landlordAddressLine1),
    landlordAddressLine2: cleanText(parsedRequest.landlordAddressLine2),
    landlordCity: cleanText(parsedRequest.landlordCity),
    landlordPostcode: cleanText(parsedRequest.landlordPostcode),
    propertyAddress: cleanText(parsedRequest.propertyAddress),
    propertyPostcode: cleanText(parsedRequest.propertyPostcode),
    jobType: parsedRequest.jobType,
    tenantName: cleanText(parsedRequest.tenantName),
    tenantPhone: cleanText(parsedRequest.tenantPhone),
    accessNotes: cleanText(parsedRequest.accessNotes),
    preferredDates: cleanText(parsedRequest.preferredDates),
    engineerName: cleanText(parsedRequest.engineerName),
    engineerEmail: normalizeEmailKey(parsedRequest.engineerEmail),
    engineerPhone: cleanText(parsedRequest.engineerPhone),
    engineerGasSafeNumber: cleanText(parsedRequest.engineerGasSafeNumber),
    engineerRequestSlug: cleanText(parsedRequest.engineerRequestSlug),
  };
  const admin = await supabaseServerServiceRole();
  const engineerProfile = await findEngineerProfileForRequest(admin, request);
  const requestId = randomUUID();
  const claimToken = engineerProfile ? null : randomUUID();
  const requestType = request.jobType === 'service' ? 'new_job' : 'new_job';
  const jobType = request.jobType === 'service' ? 'service' : 'cp12';
  const certTypes = normalizeCertTypes(request.jobType);
  const engineerDisplayName = engineerProfile?.engineerName ?? request.engineerName;
  const engineerPrefillUrl = `${getSiteUrl()}/jobs/new?requestId=${requestId}`;
  const engineerClaimUrl = claimToken ? `${getSiteUrl()}/signup/step1?claim=${claimToken}` : null;
  const engineerActionUrl = engineerClaimUrl ?? engineerPrefillUrl;

  const { error } = await fromJobRequests(admin).insert({
    id: requestId,
    user_id: engineerProfile?.id ?? null,
    assigned_engineer_id: engineerProfile?.id ?? null,
    request_type: requestType,
    source: engineerProfile ? 'standalone_known_engineer' : 'standalone_external_engineer',
    job_type: jobType,
    entry_point: 'landlord_request',
    cert_types: certTypes,
    landlord_name: request.landlordName,
    landlord_email: request.landlordEmail,
    landlord_phone: request.landlordPhone,
    property_address: request.propertyAddress,
    property_postcode: request.propertyPostcode || null,
    tenant_name: request.tenantName || null,
    tenant_phone: request.tenantPhone || null,
    access_notes: request.accessNotes || null,
    preferred_dates: request.preferredDates || null,
    engineer_name: request.engineerName,
    engineer_company: engineerProfile?.companyName ?? null,
    engineer_email: request.engineerEmail || null,
    engineer_phone: request.engineerPhone || null,
    engineer_gas_safe_number: request.engineerGasSafeNumber || engineerProfile?.gasSafeNumber || null,
    pending_engineer_email: engineerProfile ? null : request.engineerEmail || null,
    claim_token: claimToken,
    claim_token_expires_at: claimToken ? addDaysIso(30) : null,
    status: 'pending',
  });
  if (error) {
    if (error.code === '42P01') throw new Error('Job requests are not configured yet.');
    throw new Error(error.message);
  }

  if (
    request.landlordAddressLine1 ||
    request.landlordAddressLine2 ||
    request.landlordCity ||
    request.landlordPostcode
  ) {
    const { error: landlordAddressErr } = await fromJobRequests(admin)
      .update({
        landlord_address_line1: request.landlordAddressLine1 || null,
        landlord_address_line2: request.landlordAddressLine2 || null,
        landlord_city: request.landlordCity || null,
        landlord_postcode: request.landlordPostcode || null,
      })
      .eq('id', requestId);
    if (landlordAddressErr && !['42703', 'PGRST204'].includes(landlordAddressErr.code ?? '')) {
      throw new Error(landlordAddressErr.message);
    }
  }

  const landlordDisplayName = titleCase(request.landlordName);
  const engineerPublicName = titleCase(engineerProfile?.engineerName || request.engineerName || 'Your engineer');
  const propertyAddress = request.propertyAddress || 'Not provided';
  const landlordConfirmationSubject = 'Your gas safety request has been submitted';
  const landlordConfirmationStatus = (await sendEmailSafely('createPendingJobRequest.landlordConfirmation', {
    to: request.landlordEmail,
    subject: landlordConfirmationSubject,
    replyTo: engineerProfile?.email || request.engineerEmail || undefined,
    text: [
      `Hi ${landlordDisplayName},`,
      '',
      `Your gas safety job request has been sent to ${engineerPublicName}. They'll be in touch to confirm a visit date.`,
      '',
      `Property: ${propertyAddress}`,
      `Work needed: ${formatJobType(request.jobType)}`,
      `Engineer: ${engineerPublicName}`,
      `Submitted: ${formatDate(new Date().toISOString())}`,
      '',
      `You don't need to do anything else. ${engineerPublicName} will contact you directly to arrange the visit.`,
    ].join('\n'),
    html: baseEmail(
      [
        emailTitle('Request submitted'),
        emailSubtitle(`Your gas safety job request has been sent to ${engineerPublicName}. They'll be in touch to confirm a visit date.`),
        infoCard('Your request', [
          { label: 'Property', value: propertyAddress },
          { label: 'Work needed', value: formatJobType(request.jobType) },
          { label: 'Engineer', value: engineerPublicName || 'Your engineer' },
          { label: 'Submitted', value: formatDate(new Date().toISOString()) },
        ]),
        paragraph(`You don't need to do anything else. ${engineerPublicName} will contact you directly to arrange the visit.`),
      ].join(''),
      { subject: landlordConfirmationSubject, sentOnBehalfOf: engineerPublicName },
    ),
  })).status;
  const engineerNotificationRecipient = await getEngineerNotificationRecipient(admin, engineerProfile, request.engineerEmail);
  const normalizedEngineerNotificationRecipient = normalizeEmailKey(engineerNotificationRecipient);
  const notificationMatchesLandlord = Boolean(
    normalizedEngineerNotificationRecipient &&
    normalizedEngineerNotificationRecipient === normalizeEmailKey(request.landlordEmail),
  );
  const engineerNotificationTarget =
    normalizedEngineerNotificationRecipient && !notificationMatchesLandlord
      ? engineerNotificationRecipient
      : '';
  const engineerNotificationStatus = notificationMatchesLandlord
    ? 'skipped_same_recipient'
    : engineerNotificationTarget
    ? engineerProfile
      ? (await sendEmailSafely('createPendingJobRequest.matchedEngineer', {
          to: engineerNotificationTarget,
          subject: `New job request from ${landlordDisplayName}`,
          text: [
            `Hi ${titleCase(engineerDisplayName)},`,
            '',
            `${landlordDisplayName} has submitted a job request and named you as their engineer.`,
            '',
            `Property: ${propertyAddress}`,
            `Work needed: ${formatJobType(request.jobType)}`,
            `Landlord: ${landlordDisplayName}`,
            `Landlord phone: ${request.landlordPhone}`,
            `Landlord email: ${request.landlordEmail}`,
            `Tenant: ${request.tenantName || 'Not provided'}`,
            `Access notes: ${request.accessNotes || 'Not provided'}`,
            `Preferred dates: ${request.preferredDates || 'Flexible'}`,
            '',
            `Open request in CertNow: ${engineerPrefillUrl}`,
          ].join('\n'),
          html: baseEmail(
            [
              emailTitle('New job request'),
              emailSubtitle(`${landlordDisplayName} has submitted a job request and named you as their engineer.`),
              infoCard('Job details', [
                { label: 'Property', value: propertyAddress },
                { label: 'Work needed', value: formatJobType(request.jobType) },
                { label: 'Landlord', value: landlordDisplayName },
                { label: 'Landlord phone', value: request.landlordPhone || 'Not provided' },
                { label: 'Landlord email', value: request.landlordEmail || 'Not provided' },
                { label: 'Tenant', value: request.tenantName || 'Not provided' },
                { label: 'Access notes', value: request.accessNotes || 'Not provided' },
                { label: 'Preferred dates', value: request.preferredDates || 'Flexible' },
              ]),
              ctaButton('Open request in CertNow', engineerPrefillUrl, 'green'),
            ].join(''),
            { subject: `New job request from ${landlordDisplayName}` },
          ),
        })).status
      : (await sendEmailSafely('createPendingJobRequest.unregisteredEngineer', {
          to: engineerNotificationTarget,
          subject: 'A landlord tried to book you through CertNow',
          text: [
            `Hi ${titleCase(engineerDisplayName)},`,
            '',
            `${landlordDisplayName} tried to book you for a gas safety job through CertNow and listed ${request.engineerEmail} as their engineer. Create a free account to claim it.`,
            '',
            `Property: ${propertyAddress}`,
            `Work needed: ${formatJobType(request.jobType)}`,
            `Landlord: ${landlordDisplayName}`,
            `Landlord phone: ${request.landlordPhone}`,
            `Preferred dates: ${request.preferredDates || 'Flexible'}`,
            '',
            `Create free account and claim request: ${engineerClaimUrl ?? engineerActionUrl}`,
            '',
            'This link expires in 30 days.',
          ].join('\n'),
          html: baseEmail(
            [
              emailTitle('A landlord wants to book you'),
              emailSubtitle(`${landlordDisplayName} tried to book you for a gas safety job through CertNow and listed ${request.engineerEmail || engineerNotificationTarget} as their engineer. Create a free account to claim it.`),
              infoCard('The request', [
                { label: 'Property', value: propertyAddress },
                { label: 'Work needed', value: formatJobType(request.jobType) },
                { label: 'Landlord', value: landlordDisplayName },
                { label: 'Landlord phone', value: request.landlordPhone || 'Not provided' },
                { label: 'Preferred dates', value: request.preferredDates || 'Flexible' },
              ]),
              benefitList([
                'Issue CP12 certificates on site in minutes',
                'Landlords get a permanent compliance link automatically',
                'Renewal reminders sent - never chase again',
              ]),
              ctaButton('Create free account and claim request', engineerClaimUrl ?? engineerActionUrl, 'dark'),
              note('This link expires in 30 days. After that, sign up normally at certnow.uk and search for the request by landlord name.'),
            ].join(''),
            { subject: 'A landlord tried to book you through CertNow' },
          ),
        })).status
    : 'not_configured';

  const { error: statusErr } = await fromJobRequests(admin).update({
    landlord_confirmation_status: landlordConfirmationStatus,
    engineer_notification_status: engineerNotificationStatus,
    updated_at: new Date().toISOString(),
  }).eq('id', requestId);
  if (statusErr) throw new Error(statusErr.message);

  return {
    ok: true,
    landlordConfirmationStatus,
    engineerNotificationStatus,
    requestId,
    engineerActionUrl,
    engineerMatched: Boolean(engineerProfile),
  };
}

export async function submitStandaloneLandlordJobRequest(input: z.input<typeof StandaloneJobRequestSchema>) {
  return createPendingJobRequest(input);
}
