'use server';

import { randomUUID } from 'crypto';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

import { supabaseServerReadOnly, supabaseServerServiceRole, getSupabaseUser } from '@/lib/supabaseServer';

const RequestIdSchema = z.string().uuid();
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

type EmailDeliveryStatus = 'sent' | 'not_configured' | 'failed';

const getSiteUrl = () =>
  (process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'http://localhost:3000').replace(/\/$/, '');

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
          <td style="padding:10px 0;color:#64748b;font-size:13px;width:150px;">${escapeHtml(row.label)}</td>
          <td style="padding:10px 0;color:#111111;font-size:14px;font-weight:700;">${escapeHtml(row.value)}</td>
        </tr>
      `,
    )
    .join('');

  return `
<!doctype html>
<html>
  <body style="margin:0;background:#f4f1ea;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#111111;">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(input.preheader)}</div>
    <main style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #e8e0d5;">
      <section style="padding:28px 28px 18px;background:#111111;color:#ffffff;">
        <div style="font-size:22px;font-weight:800;letter-spacing:-0.04em;">certnow</div>
        <h1 style="margin:22px 0 8px;font-size:28px;line-height:1.08;">${escapeHtml(input.title)}</h1>
        <p style="margin:0;color:#e5e7eb;font-size:15px;line-height:1.55;">${escapeHtml(input.intro)}</p>
      </section>
      <section style="padding:24px 28px 8px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          ${rows}
        </table>
        ${
          input.button
            ? `<div style="padding:22px 0 10px;">
                <a href="${escapeHtml(input.button.href)}" style="display:inline-block;border-radius:999px;background:#111111;color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;padding:14px 20px;">${escapeHtml(input.button.label)}</a>
              </div>
              <p style="margin:4px 0 0;color:#64748b;font-size:12px;line-height:1.5;">If the button does not work, paste this link into your browser:<br><span style="color:#111111;">${escapeHtml(input.button.href)}</span></p>`
            : ''
        }
      </section>
      <section style="padding:18px 28px 26px;">
        <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">${escapeHtml(input.footer ?? 'Sent by CertNow.')}</p>
      </section>
    </main>
  </body>
</html>`;
}

async function sendTransactionalEmail(input: { to: string; subject: string; text: string; html?: string }): Promise<EmailDeliveryStatus> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) return 'not_configured';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    });
    return response.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
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
  const { data, error } = await fromJobRequests(admin)
    .select('*')
    .or(`user_id.eq.${user.id},assigned_engineer_id.eq.${user.id}`)
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
  const { error } = await fromJobRequests(admin)
    .update({ status: 'dismissed', updated_at: new Date().toISOString() })
    .eq('id', parsed)
    .or(`user_id.eq.${user.id},assigned_engineer_id.eq.${user.id}`);
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard');
  return { ok: true };
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
  const request = normalizeRequest(data as Record<string, unknown>);
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

export async function submitStandaloneLandlordJobRequest(input: z.infer<typeof StandaloneJobRequestSchema>) {
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
    engineerEmail: cleanText(parsedRequest.engineerEmail),
    engineerPhone: cleanText(parsedRequest.engineerPhone),
  };
  const admin = await supabaseServerServiceRole();
  const requestId = randomUUID();
  const requestType = request.jobType === 'service' ? 'new_job' : 'new_job';
  const jobType = request.jobType === 'service' ? 'service' : 'cp12';
  const engineerContact = [request.engineerName, request.engineerEmail, request.engineerPhone]
    .filter(Boolean)
    .join(' / ');
  const engineerPrefillUrl = `${getSiteUrl()}/jobs/new?requestId=${requestId}`;

  const { error } = await fromJobRequests(admin).insert({
    id: requestId,
    user_id: null,
    assigned_engineer_id: null,
    request_type: requestType,
    source: 'standalone_external_engineer',
    job_type: jobType,
    landlord_name: request.landlordName,
    landlord_email: request.landlordEmail,
    landlord_phone: request.landlordPhone,
    landlord_address_line1: request.landlordAddressLine1 || null,
    landlord_address_line2: request.landlordAddressLine2 || null,
    landlord_city: request.landlordCity || null,
    landlord_postcode: request.landlordPostcode || null,
    property_address: request.propertyAddress,
    property_postcode: request.propertyPostcode || null,
    tenant_name: request.tenantName || null,
    tenant_phone: request.tenantPhone || null,
    access_notes: request.accessNotes || null,
    preferred_dates: request.preferredDates || null,
    engineer_name: request.engineerName,
    engineer_company: null,
    engineer_email: request.engineerEmail || null,
    engineer_phone: request.engineerPhone || null,
    engineer_gas_safe_number: null,
    status: 'pending',
  });
  if (error) {
    if (error.code === '42P01') throw new Error('Job requests are not configured yet.');
    throw new Error(error.message);
  }

  const landlordConfirmationStatus = await sendTransactionalEmail({
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
      'The engineer contact you supplied has also been sent the request details if an email address was provided.',
    ].join('\n'),
    html: renderEmailShell({
      preheader: `Your CertNow request for ${request.propertyAddress} has been submitted.`,
      title: 'Your job request has been submitted',
      intro: 'We have recorded your request and sent the details to the engineer contact you provided if an email address was supplied.',
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
  });
  const engineerNotificationStatus = request.engineerEmail
    ? await sendTransactionalEmail({
        to: request.engineerEmail,
        subject: 'New landlord job request from CertNow',
        text: [
          `Hi ${request.engineerName},`,
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
          `Open prefilled job: ${engineerPrefillUrl}`,
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
          button: { label: 'Open prefilled job', href: engineerPrefillUrl },
          footer: 'You will need to sign in to CertNow. When you save the job, this request is linked to your account and marked as scheduled.',
        }),
      })
    : 'not_configured';

  const { error: statusErr } = await fromJobRequests(admin).update({
    landlord_confirmation_status: landlordConfirmationStatus,
    engineer_notification_status: engineerNotificationStatus,
    updated_at: new Date().toISOString(),
  }).eq('id', requestId);
  if (statusErr) throw new Error(statusErr.message);

  return { ok: true, landlordConfirmationStatus, engineerNotificationStatus, requestId };
}
