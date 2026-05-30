'use server';

import { randomUUID } from 'crypto';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

import { sendEmail } from '@/lib/resend';
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

const escapeHtml = (value: string | null | undefined) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

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

function renderEmailShell(input: {
  preheader: string;
  title: string;
  intro: string;
  rows: Array<{ label: string; value: string | null | undefined }>;
  button?: { label: string; href: string };
  footer?: string;
}) {
  const rows = input.rows
    .filter((row) => String(row.value ?? '').trim().length > 0)
    .map(
      (row) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6b7280;font-size:13px;width:140px;vertical-align:top;">${escapeHtml(row.label)}</td>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#111111;font-size:14px;font-weight:600;">${escapeHtml(row.value)}</td>
        </tr>
      `,
    )
    .join('');

  return `
<!doctype html>
<html>
  <body style="margin:0;background:#f4f4f4;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;color:#111111;">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(input.preheader)}</div>
    <main style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e0e0e0;">
      <section style="padding:24px 24px 20px;background:#111111;color:#ffffff;">
        <div style="font-size:18px;font-weight:800;letter-spacing:-0.04em;">certnow</div>
        <h1 style="margin:20px 0 6px;font-size:24px;font-weight:700;line-height:1.15;">${escapeHtml(input.title)}</h1>
        <p style="margin:0;color:#d1d5db;font-size:14px;line-height:1.6;">${escapeHtml(input.intro)}</p>
      </section>
      <section style="padding:20px 24px 8px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          ${rows}
        </table>
        ${
          input.button
            ? `<div style="padding:20px 0 10px;">
                <a href="${escapeHtml(input.button.href)}" style="display:inline-block;border-radius:8px;background:#111111;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 20px;letter-spacing:0.01em;">${escapeHtml(input.button.label)}</a>
              </div>
              <p style="margin:4px 0 0;color:#9ca3af;font-size:12px;line-height:1.5;">If the button does not work, paste this link into your browser:<br><span style="color:#374151;">${escapeHtml(input.button.href)}</span></p>`
            : ''
        }
      </section>
      <section style="padding:16px 24px 22px;border-top:1px solid #f0f0f0;">
        <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">${escapeHtml(input.footer ?? 'Sent by CertNow.')}</p>
      </section>
    </main>
  </body>
</html>`;
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
  const engineerName = user?.email ?? 'your engineer';
  const landlordName = cleanText(parsed.landlordName);
  const status = (await sendEmail({
    to: parsed.landlordEmail,
    subject: 'Please send your job details to CertNow',
    text: [
      landlordName ? `Hi ${landlordName},` : 'Hi,',
      '',
      `${engineerName} has asked you to send the property and access details for your job through CertNow.`,
      '',
      `Open the request form: ${link.url}`,
      '',
      'You will not need to enter the engineer details again.',
    ].join('\n'),
    html: renderEmailShell({
      preheader: 'Send your job details to your engineer through CertNow.',
      title: 'Send your job details',
      intro: `${engineerName} has asked you to send the property, access, and preferred date details through CertNow.`,
      rows: [
        { label: 'Engineer request link', value: link.url },
      ],
      button: { label: 'Open request form', href: link.url },
      footer: 'This link is scoped to the engineer, so you will not need to enter their details.',
    }),
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
  const status = (await sendEmail({
    to: engineerEmail,
    subject: 'New landlord job request from CertNow',
    text: [
      `${request.landlordName ?? 'A landlord'} submitted a gas compliance job request.`,
      '',
      `Property: ${request.propertyAddress ?? 'Not provided'}`,
      `Landlord phone: ${request.landlordPhone ?? 'Not provided'}`,
      `Preferred dates: ${request.preferredDates ?? 'Not provided'}`,
      '',
      `Open prefilled job: ${href}`,
    ].join('\n'),
    html: renderEmailShell({
      preheader: `${request.landlordName ?? 'A landlord'} sent a gas compliance job request.`,
      title: 'New landlord job request',
      intro: 'Open the request to create a job with Step 1 prefilled.',
      rows: [
        { label: 'Landlord', value: request.landlordName },
        { label: 'Landlord phone', value: request.landlordPhone },
        { label: 'Landlord email', value: request.landlordEmail },
        { label: 'Property', value: request.propertyAddress },
        { label: 'Work needed', value: formatJobType(request.jobType) },
        { label: 'Tenant', value: request.tenantName || 'Not provided' },
        { label: 'Access notes', value: request.accessNotes || 'Not provided' },
        { label: 'Preferred dates', value: request.preferredDates || 'Not provided' },
      ],
      button: { label: 'Open prefilled job', href },
    }),
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
  const engineerContact = [request.engineerName, request.engineerEmail, request.engineerPhone]
    .filter(Boolean)
    .join(' / ');
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

  const landlordConfirmationStatus = (await sendEmail({
    to: request.landlordEmail,
    subject: 'Your CertNow job request has been submitted',
    text: [
      `Hi ${request.landlordName},`,
      '',
      'Your gas compliance job request has been submitted.',
      '',
      `Property: ${request.propertyAddress}`,
      `Work needed: ${request.jobType}`,
      `Engineer contact supplied: ${engineerContact}`,
      `Preferred dates: ${request.preferredDates || 'Not provided'}`,
      '',
      'Your engineer will contact you directly to arrange the visit.',
    ].join('\n'),
    html: renderEmailShell({
      preheader: `Your CertNow request for ${request.propertyAddress} has been submitted.`,
      title: 'Your job request has been submitted',
      intro: 'We have recorded your request. Your engineer will contact you directly to arrange the visit.',
      rows: [
        { label: 'Property', value: request.propertyAddress },
        { label: 'Work needed', value: formatJobType(request.jobType) },
        { label: 'Engineer', value: engineerContact },
        { label: 'Preferred dates', value: request.preferredDates || 'Not provided' },
        { label: 'Tenant', value: request.tenantName || 'Not provided' },
        { label: 'Access notes', value: request.accessNotes || 'Not provided' },
      ],
      footer: 'The engineer will contact you directly to arrange the visit.',
    }),
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
      ? (await sendEmail({
          to: engineerNotificationTarget,
          subject: 'New landlord job request from CertNow',
          text: [
            `Hi ${engineerDisplayName},`,
            '',
            `${request.landlordName} submitted a gas compliance job request and listed you as their chosen engineer.`,
            '',
            `Landlord phone: ${request.landlordPhone}`,
            `Landlord email: ${request.landlordEmail}`,
            `Property: ${request.propertyAddress}`,
            `Work needed: ${request.jobType}`,
            `Tenant: ${request.tenantName || 'Not provided'}`,
            `Tenant phone: ${request.tenantPhone || 'Not provided'}`,
            `Access notes: ${request.accessNotes || 'Not provided'}`,
            `Preferred dates: ${request.preferredDates || 'Not provided'}`,
            '',
            `Open the prefilled job request: ${engineerPrefillUrl}`,
          ].join('\n'),
          html: renderEmailShell({
            preheader: `${request.landlordName} sent a gas compliance job request for ${request.propertyAddress}.`,
            title: 'New landlord job request',
            intro: `${request.landlordName} listed you as their chosen engineer. Open the request to create a job with Step 1 prefilled.`,
            rows: [
              { label: 'Landlord', value: request.landlordName },
              { label: 'Landlord phone', value: request.landlordPhone },
              { label: 'Landlord email', value: request.landlordEmail },
              { label: 'Property', value: request.propertyAddress },
              { label: 'Work needed', value: formatJobType(request.jobType) },
              { label: 'Tenant', value: request.tenantName || 'Not provided' },
              { label: 'Tenant phone', value: request.tenantPhone || 'Not provided' },
              { label: 'Access notes', value: request.accessNotes || 'Not provided' },
              { label: 'Preferred dates', value: request.preferredDates || 'Not provided' },
            ],
            button: {
              label: 'Open prefilled job',
              href: engineerPrefillUrl,
            },
            footer: 'Sign in to CertNow to review the request. When you save the job, this request is linked to your account and marked as scheduled.',
          }),
        })).status
      : (await sendEmail({
          to: engineerNotificationTarget,
          subject: 'A landlord requested you through CertNow',
          text: [
            `Hi ${engineerDisplayName},`,
            '',
            `${request.landlordName} submitted a gas compliance job request and listed you as their chosen engineer.`,
            '',
            `Landlord phone: ${request.landlordPhone}`,
            `Landlord email: ${request.landlordEmail}`,
            `Property: ${request.propertyAddress}`,
            `Work needed: ${request.jobType}`,
            `Tenant: ${request.tenantName || 'Not provided'}`,
            `Tenant phone: ${request.tenantPhone || 'Not provided'}`,
            `Access notes: ${request.accessNotes || 'Not provided'}`,
            `Preferred dates: ${request.preferredDates || 'Not provided'}`,
            '',
            `Create your CertNow account to claim this request: ${engineerClaimUrl}`,
          ].join('\n'),
          html: renderEmailShell({
            preheader: `${request.landlordName} sent a gas compliance job request for ${request.propertyAddress}.`,
            title: 'A landlord requested you through CertNow',
            intro: `${request.landlordName} listed you as their chosen engineer. Create your CertNow account to claim the request and open the job with Step 1 prefilled.`,
            rows: [
              { label: 'Landlord', value: request.landlordName },
              { label: 'Landlord phone', value: request.landlordPhone },
              { label: 'Landlord email', value: request.landlordEmail },
              { label: 'Property', value: request.propertyAddress },
              { label: 'Work needed', value: formatJobType(request.jobType) },
              { label: 'Tenant', value: request.tenantName || 'Not provided' },
              { label: 'Tenant phone', value: request.tenantPhone || 'Not provided' },
              { label: 'Access notes', value: request.accessNotes || 'Not provided' },
              { label: 'Preferred dates', value: request.preferredDates || 'Not provided' },
            ],
            button: {
              label: 'Create account and claim request',
              href: engineerClaimUrl ?? engineerActionUrl,
            },
            footer: 'The claim link is token-based, so you can sign up with the email address you normally use for CertNow.',
          }),
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
