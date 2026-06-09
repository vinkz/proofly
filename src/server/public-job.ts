'use server';

import { z } from 'zod';

import { supabaseServerReadOnly, supabaseServerServiceRole, getSupabaseUser } from '@/lib/supabaseServer';
import { isEmailConfigured, sendEmail } from '@/lib/resend';
import { baseEmail, ctaButton, emailSubtitle, emailTitle, formatDate, infoCard, note, titleCase } from '@/lib/email-templates';
import { CERTIFICATE_LABELS, type CertificateType } from '@/types/certificates';

const getSiteUrl = () =>
  (
    process.env.NEXT_PUBLIC_SHARE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    'https://certnow.uk'
  ).replace(/\/$/, '');

type PublicCertificate = {
  id: string;
  certType: string;
  label: string;
  issuedAt: string | null;
  downloadUrl: string | null;
};

type PublicInvoice = {
  id: string;
  invoiceNumber: string | null;
  status: string | null;
  paymentStatus: string | null;
  paymentLinkUrl: string | null;
  issueDate: string | null;
  dueDate: string | null;
  downloadUrl: string | null;
};

type UntypedQuery = {
  select: (columns?: string) => UntypedQuery;
  eq: (column: string, value: unknown) => UntypedQuery;
  or: (query: string) => UntypedQuery;
  order: (column: string, options?: { ascending?: boolean }) => UntypedQuery;
  limit: (count: number) => UntypedQuery;
  maybeSingle: () => Promise<{ data: unknown; error: { code?: string; message: string } | null }>;
  insert: (payload: Record<string, unknown> | Array<Record<string, unknown>>) => Promise<{
    error: { code?: string; message: string } | null;
  }>;
};
type UntypedSupabase = { from: (table: string) => UntypedQuery };
const fromJobRequests = (sb: unknown) => (sb as UntypedSupabase).from('job_requests');
const fromUntyped = (sb: unknown, table: string) => (sb as UntypedSupabase).from(table);

export type PublicJobPageData = {
  token: string;
  jobId: string;
  engineerOwnsJob: boolean;
  address: string;
  jobTitle: string;
  jobStatus: string;
  requestStatus: string | null;
  requestType: string | null;
  completedWork: string[];
  certificates: PublicCertificate[];
  invoice: PublicInvoice | null;
  nextInspectionDue: string | null;
  renewalRequestedAt: string | null;
  landlordEmail: string | null;
  landlordHasMultipleJobs: boolean;
  landlordName: string | null;
  engineer: {
    name: string | null;
    company: string | null;
    gasSafeNumber: string | null;
    phone: string | null;
    email: string | null;
  };
};

const PublicTokenSchema = z.string().min(16).max(128).regex(/^[a-zA-Z0-9_-]+$/);
const EmailCaptureSchema = z.object({
  token: PublicTokenSchema,
  email: z.string().email(),
});
const RenewalRequestSchema = z.object({
  token: PublicTokenSchema,
  tenantName: z.string().max(120).optional().default(''),
  tenantPhone: z.string().max(80).optional().default(''),
  accessNotes: z.string().max(1000).optional().default(''),
  preferredDates: z.string().max(500).optional().default(''),
  preferredDate: z.string().max(20).optional().default(''),
});

const normalizeDateOnly = (value: string | null | undefined): string => {
  const slice = String(value ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(slice) ? slice : '';
};

const pickText = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return '';
};

const addOneYear = (dateOnly: string | null | undefined) => {
  const normalized = String(dateOnly ?? '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const date = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString().slice(0, 10);
};

function resolveNextInspectionDue(fields: Record<string, string | null>, certificates: Array<{ cert_type?: string | null; issued_at?: string | null; created_at?: string | null }>) {
  const explicit = pickText(fields.next_inspection_due, fields.next_inspection_date);
  if (explicit) return explicit.slice(0, 10);
  const cp12 = certificates.find((certificate) => certificate.cert_type === 'cp12');
  return addOneYear(pickText(fields.completion_date, cp12?.issued_at, cp12?.created_at));
}

export async function getPublicJobByToken(token: string): Promise<PublicJobPageData | null> {
  const parsedToken = PublicTokenSchema.safeParse(token);
  if (!parsedToken.success) return null;

  const admin = await supabaseServerServiceRole();
  const readonly = await supabaseServerReadOnly();
  const currentUser = await getSupabaseUser(readonly);

  const { data: job, error: jobErr } = await admin
    .from('jobs')
    .select('id, user_id, client_id, client_name, address, title, status, job_type, scheduled_for, created_at, public_token')
    .eq('public_token', parsedToken.data)
    .maybeSingle();
  if (jobErr) throw new Error(jobErr.message);
  if (!job) return null;

  const [{ data: fields }, { data: certificates }, { data: profile }, { data: client }, { data: invoice }, { data: requestRow }] = await Promise.all([
    admin.from('job_fields').select('field_key, value').eq('job_id', job.id),
    admin
      .from('certificates')
      .select('id, cert_type, issued_at, created_at, pdf_path, pdf_url')
      .eq('job_id', job.id)
      .order('created_at', { ascending: true }),
    admin
      .from('profiles')
      .select('default_engineer_name, full_name, company_name, gas_safe_number, company_phone, company_email')
      .eq('id', job.user_id ?? '')
      .maybeSingle(),
    job.client_id
      ? admin.from('clients').select('name, email, phone').eq('id', job.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
    fromUntyped(admin, 'invoices')
      .select('id, invoice_number, status, payment_status, payment_link_url, issue_date, due_date, pdf_path, created_at')
      .eq('job_id', job.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    fromUntyped(admin, 'job_requests')
      .select('id, request_type, status, created_at')
      .or(`scheduled_job_id.eq.${job.id},source_job_id.eq.${job.id}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const fieldMap = Object.fromEntries((fields ?? []).map((field) => [field.field_key ?? '', field.value ?? null]));
  const certRows = certificates ?? [];
  const publicCertificates: PublicCertificate[] = await Promise.all(
    certRows.map(async (certificate) => {
      let downloadUrl = certificate.pdf_url ?? null;
      if (certificate.pdf_path) {
        const { data } = await admin.storage.from('certificates').createSignedUrl(certificate.pdf_path, 60 * 60);
        downloadUrl = data?.signedUrl ?? downloadUrl;
      }
      const certType = certificate.cert_type ?? 'certificate';
      return {
        id: certificate.id,
        certType,
        label: CERTIFICATE_LABELS[certType as CertificateType] ?? certType.replaceAll('_', ' '),
        issuedAt: certificate.issued_at ?? certificate.created_at ?? null,
        downloadUrl,
      };
    }),
  );

  const address = pickText(
    fieldMap.property_address,
    [
      fieldMap.job_address_line1,
      fieldMap.job_address_line2,
      fieldMap.job_address_city,
      fieldMap.job_postcode,
    ].filter(Boolean).join(', '),
    job.address,
  );

  const invoiceRow = invoice as Record<string, unknown> | null;
  let invoiceDownloadUrl: string | null = null;
  if (typeof invoiceRow?.pdf_path === 'string' && invoiceRow.pdf_path.trim()) {
    const { data } = await admin.storage.from('invoices').createSignedUrl(invoiceRow.pdf_path, 60 * 60);
    invoiceDownloadUrl = data?.signedUrl ?? null;
  }

  const publicInvoice: PublicInvoice | null = invoiceRow
    ? {
        id: String(invoiceRow.id ?? ''),
        invoiceNumber: typeof invoiceRow.invoice_number === 'string' ? invoiceRow.invoice_number : null,
        status: typeof invoiceRow.status === 'string' ? invoiceRow.status : null,
        paymentStatus: typeof invoiceRow.payment_status === 'string' ? invoiceRow.payment_status : null,
        paymentLinkUrl: typeof invoiceRow.payment_link_url === 'string' ? invoiceRow.payment_link_url : null,
        issueDate: typeof invoiceRow.issue_date === 'string' ? invoiceRow.issue_date : null,
        dueDate: typeof invoiceRow.due_date === 'string' ? invoiceRow.due_date : null,
        downloadUrl: invoiceDownloadUrl,
      }
    : null;

  const request = requestRow as Record<string, unknown> | null;

  const landlordEmail = pickText(fieldMap.landlord_email, client?.email ?? null) || null;
  let landlordJobCount = 0;
  if (landlordEmail) {
    const { data: matchingClients } = await admin.from('clients').select('id').eq('email', landlordEmail);
    const clientIds = (matchingClients ?? []).map((row) => row.id).filter(Boolean);
    if (clientIds.length) {
      const { count } = await admin
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .in('client_id', clientIds);
      landlordJobCount = count ?? 0;
    }
  }

  return {
    token: parsedToken.data,
    jobId: job.id,
    engineerOwnsJob: Boolean(currentUser?.id && job.user_id === currentUser.id),
    address,
    jobTitle: pickText(job.title, job.client_name, 'Compliance visit'),
    jobStatus: job.status ?? 'completed',
    requestStatus: typeof request?.status === 'string' ? request.status : null,
    requestType: typeof request?.request_type === 'string' ? request.request_type : null,
    completedWork: publicCertificates.length
      ? publicCertificates.map((certificate) => certificate.label)
      : [pickText(job.title, job.job_type, 'Compliance work')],
    certificates: publicCertificates,
    invoice: publicInvoice,
    nextInspectionDue: resolveNextInspectionDue(fieldMap, certRows),
    renewalRequestedAt: pickText(fieldMap.renewal_requested_at) || null,
    landlordEmail,
    landlordHasMultipleJobs: landlordJobCount > 1,
    landlordName: pickText(fieldMap.landlord_name, client?.name ?? null, job.client_name) || null,
    engineer: {
      name: pickText(profile?.default_engineer_name, profile?.full_name) || null,
      company: profile?.company_name ?? null,
      gasSafeNumber: profile?.gas_safe_number ?? null,
      phone: profile?.company_phone ?? null,
      email: profile?.company_email ?? null,
    },
  };
}

export async function capturePublicJobLandlordEmail(input: z.infer<typeof EmailCaptureSchema>) {
  const { token, email } = EmailCaptureSchema.parse(input);
  const admin = await supabaseServerServiceRole();
  const { data: job, error: jobErr } = await admin
    .from('jobs')
    .select('id, client_id, public_token')
    .eq('public_token', token)
    .maybeSingle();
  if (jobErr) throw new Error(jobErr.message);
  if (!job) throw new Error('Job not found');

  await admin.from('job_fields').delete().eq('job_id', job.id).eq('field_key', 'landlord_email');
  const { error: fieldErr } = await admin.from('job_fields').insert({
    job_id: job.id,
    field_key: 'landlord_email',
    value: email,
  });
  if (fieldErr) throw new Error(fieldErr.message);

  if (job.client_id) {
    await admin.from('clients').update({ email }).eq('id', job.client_id);
  }

  const pageData = await getPublicJobByToken(token);
  return {
    ok: true,
    nextInspectionDue: pageData?.nextInspectionDue ?? null,
    engineer: pageData?.engineer ?? null,
  };
}

/**
 * Make sure a renewal CP12 job exists for the landlord's confirmation to land on. In the normal
 * flow this job was auto-created when the original CP12 was issued (linked by
 * `follow_up_source_job_id`). For older or service-only jobs that have no follow-up, we create one
 * here from the source job's landlord/property details so the engineer always gets a real job with
 * the confirmed date and access notes — never a dangling request. Best-effort; returns null on any
 * failure so the landlord submission is never blocked.
 */
async function ensureRenewalJobForSource(
  admin: Awaited<ReturnType<typeof supabaseServerServiceRole>>,
  params: {
    sourceJob: { id: string; user_id: string | null; client_id: string | null; client_name: string | null; address: string | null };
    acceptedDate: string;
    tenantName: string;
    tenantPhone: string;
    accessNotes: string;
  },
): Promise<string | null> {
  const { sourceJob, acceptedDate, tenantName, tenantPhone, accessNotes } = params;
  try {
    const existing = await admin
      .from('job_fields')
      .select('job_id')
      .eq('field_key', 'follow_up_source_job_id')
      .eq('value', sourceJob.id)
      .limit(1)
      .maybeSingle();
    let renewalJobId = (existing.data as { job_id?: string | null } | null)?.job_id ?? null;

    if (!renewalJobId) {
      // No follow-up job on record — build one from the source job's stored fields.
      const { data: sourceFields } = await admin
        .from('job_fields')
        .select('field_key, value')
        .eq('job_id', sourceJob.id);
      const fieldMap = Object.fromEntries(
        (sourceFields ?? []).map((row) => [row.field_key ?? '', row.value ?? null]),
      ) as Record<string, string | null>;
      const landlordName = pickText(fieldMap.landlord_name, sourceJob.client_name);
      const propertyAddress = pickText(
        fieldMap.property_address,
        [fieldMap.job_address_line1, fieldMap.job_address_line2, fieldMap.job_address_city, fieldMap.job_postcode]
          .filter(Boolean)
          .join(', '),
        sourceJob.address,
      );
      const { data: createdJob, error: createErr } = await admin
        .from('jobs')
        .insert({
          client_id: sourceJob.client_id ?? null,
          client_name: landlordName || sourceJob.client_name || null,
          address: propertyAddress || sourceJob.address || null,
          status: 'active',
          user_id: sourceJob.user_id,
          job_type: 'safety_check',
          title: `CP12 for ${landlordName || 'upcoming job'}`,
        } as never)
        .select('id')
        .single();
      if (createErr || !createdJob) {
        console.error('[public-job] failed to create renewal job:', createErr?.message);
        return null;
      }
      renewalJobId = (createdJob as { id: string }).id;

      // Carry across the landlord/property fields so the engineer opens a pre-filled job.
      const carryKeys = [
        'landlord_name', 'landlord_company', 'landlord_address_line1', 'landlord_address_line2',
        'landlord_city', 'landlord_postcode', 'landlord_tel', 'landlord_email', 'landlord_address',
        'property_address', 'property_name', 'job_address_name', 'job_address_line1', 'job_address_line2',
        'job_address_city', 'job_postcode', 'postcode',
      ];
      const carryRows = carryKeys
        .map((key) => (fieldMap[key] ? { job_id: renewalJobId as string, field_key: key, value: fieldMap[key] } : null))
        .filter((row): row is { job_id: string; field_key: string; value: string } => Boolean(row));
      carryRows.push({ job_id: renewalJobId, field_key: 'follow_up_source_job_id', value: sourceJob.id });
      await admin.from('job_fields').insert(carryRows);
    }

    if (acceptedDate) {
      await admin
        .from('jobs')
        .update({ scheduled_for: `${acceptedDate}T09:00`, status: 'active' })
        .eq('id', renewalJobId);
      await admin
        .from('job_fields')
        .delete()
        .eq('job_id', renewalJobId)
        .eq('field_key', 'inspection_date');
      await admin.from('job_fields').insert({ job_id: renewalJobId, field_key: 'inspection_date', value: acceptedDate });
    }

    const noteRows = [
      tenantName ? { job_id: renewalJobId, field_key: 'tenant_name', value: tenantName } : null,
      tenantPhone ? { job_id: renewalJobId, field_key: 'tenant_phone', value: tenantPhone } : null,
      accessNotes ? { job_id: renewalJobId, field_key: 'access_notes', value: accessNotes } : null,
    ].filter((row): row is { job_id: string; field_key: string; value: string } => Boolean(row));
    if (noteRows.length) {
      await admin
        .from('job_fields')
        .delete()
        .eq('job_id', renewalJobId)
        .in('field_key', noteRows.map((row) => row.field_key));
      await admin.from('job_fields').insert(noteRows);
    }

    return renewalJobId;
  } catch (error) {
    console.error('[public-job] ensureRenewalJobForSource failed:', error);
    return null;
  }
}

export async function submitPublicJobRenewalRequest(input: z.infer<typeof RenewalRequestSchema>) {
  const request = RenewalRequestSchema.parse(input);
  const pageData = await getPublicJobByToken(request.token);
  if (!pageData) throw new Error('Job not found');

  const admin = await supabaseServerServiceRole();
  const { data: job, error: jobErr } = await admin
    .from('jobs')
    .select('id, user_id, client_id, client_name, address')
    .eq('public_token', request.token)
    .maybeSingle();
  if (jobErr) throw new Error(jobErr.message);
  if (!job) throw new Error('Job not found');
  const acceptedDate = normalizeDateOnly(request.preferredDate);
  const preferredSummary =
    [acceptedDate, request.preferredDates].map((value) => value?.trim()).filter(Boolean).join(' · ') || null;

  // Ensure a real, pre-filled renewal job exists and (when a date was confirmed) schedule it.
  const renewalJobId = await ensureRenewalJobForSource(admin, {
    sourceJob: job,
    acceptedDate,
    tenantName: request.tenantName,
    tenantPhone: request.tenantPhone,
    accessNotes: request.accessNotes,
  });

  // A confirmed date means the visit is booked, not just requested — surface it as 'scheduled'
  // and link the job so it shows in upcoming work; otherwise it stays a 'pending' request.
  const requestStatus = acceptedDate ? 'scheduled' : 'pending';
  const insertRow: Record<string, unknown> = {
    source_job_id: pageData.jobId,
    scheduled_job_id: renewalJobId,
    user_id: job.user_id,
    assigned_engineer_id: job.user_id,
    request_type: 'renewal',
    source: 'public_job_page',
    job_type: 'cp12',
    landlord_name: pageData.landlordName,
    landlord_email: pageData.landlordEmail,
    landlord_phone: null,
    property_address: pageData.address,
    tenant_name: request.tenantName || null,
    tenant_phone: request.tenantPhone || null,
    access_notes: request.accessNotes || null,
    preferred_dates: preferredSummary,
    status: requestStatus,
  };
  const { error } = await fromJobRequests(admin).insert(insertRow);
  if (error) {
    if (error.code === '42P01') throw new Error('Renewal requests are not configured yet.');
    // Older databases may not have scheduled_job_id — retry without it rather than fail the landlord.
    if (['42703', 'PGRST204'].includes(error.code ?? '')) {
      delete insertRow.scheduled_job_id;
      const { error: retryErr } = await fromJobRequests(admin).insert(insertRow);
      if (retryErr) throw new Error(retryErr.message);
    } else {
      throw new Error(error.message);
    }
  }

  // Clear the "renewal requested" marker on the source job now that the landlord has responded.
  try {
    await admin.from('job_fields').delete().eq('job_id', pageData.jobId).eq('field_key', 'renewal_requested_at');
  } catch (clearError) {
    console.error('[public-job] failed to clear renewal_requested_at:', clearError);
  }

  // Confirm back to the engineer by email so the booking doesn't only live on a dashboard list.
  await notifyEngineerOfRenewalResponse({
    admin,
    engineerUserId: job.user_id,
    address: pageData.address,
    landlordName: pageData.landlordName,
    acceptedDate,
    preferredDates: request.preferredDates,
    tenantName: request.tenantName,
    tenantPhone: request.tenantPhone,
    accessNotes: request.accessNotes,
    renewalJobId,
  });

  return {
    ok: true,
    engineer: pageData.engineer,
    scheduled: Boolean(acceptedDate),
  };
}

async function notifyEngineerOfRenewalResponse(params: {
  admin: Awaited<ReturnType<typeof supabaseServerServiceRole>>;
  engineerUserId: string | null;
  address: string;
  landlordName: string | null;
  acceptedDate: string;
  preferredDates: string;
  tenantName: string;
  tenantPhone: string;
  accessNotes: string;
  renewalJobId: string | null;
}) {
  const { admin, engineerUserId, address, landlordName, acceptedDate, preferredDates, tenantName, tenantPhone, accessNotes, renewalJobId } = params;
  if (!engineerUserId || !isEmailConfigured()) return;
  try {
    const { data: profile } = await admin
      .from('profiles')
      .select('company_email')
      .eq('id', engineerUserId)
      .maybeSingle();
    let recipient = pickText((profile as { company_email?: string | null } | null)?.company_email);
    if (!recipient) {
      const { data: authUser } = await admin.auth.admin.getUserById(engineerUserId);
      recipient = pickText(authUser?.user?.email);
    }
    if (!recipient) return;

    const propertyLabel = address || 'the property';
    const dateConfirmed = Boolean(acceptedDate);
    const subject = dateConfirmed
      ? `Renewal confirmed — ${propertyLabel}`
      : `Renewal response — ${propertyLabel}`;
    const headline = dateConfirmed
      ? 'A landlord confirmed a renewal date'
      : 'A landlord responded to your renewal request';
    const jobHref = renewalJobId ? `${getSiteUrl()}/jobs/${renewalJobId}` : `${getSiteUrl()}/dashboard`;

    const rows: Array<{ label: string; value: string }> = [
      { label: 'Property', value: propertyLabel },
      { label: 'Landlord', value: titleCase(landlordName || 'Landlord') },
    ];
    if (dateConfirmed) rows.push({ label: 'Confirmed date', value: formatDate(acceptedDate) });
    if (preferredDates.trim()) rows.push({ label: 'Timing notes', value: preferredDates.trim() });
    if (tenantName.trim()) rows.push({ label: 'Tenant', value: tenantName.trim() });
    if (tenantPhone.trim()) rows.push({ label: 'Tenant phone', value: tenantPhone.trim() });
    if (accessNotes.trim()) rows.push({ label: 'Access notes', value: accessNotes.trim() });

    await sendEmail({
      to: recipient,
      subject,
      text: [
        headline,
        '',
        ...rows.map((row) => `${row.label}: ${row.value}`),
        '',
        dateConfirmed
          ? `The renewal job is scheduled and ready to open: ${jobHref}`
          : `Open the request to follow up: ${jobHref}`,
      ].join('\n'),
      html: baseEmail(
        [
          emailTitle(dateConfirmed ? 'Renewal date confirmed' : 'Renewal response received'),
          emailSubtitle(
            dateConfirmed
              ? `The landlord confirmed ${formatDate(acceptedDate)} for ${propertyLabel}. The renewal job is scheduled with their access details.`
              : `The landlord responded about the renewal at ${propertyLabel}.`,
          ),
          infoCard('Renewal', rows),
          ctaButton(dateConfirmed ? 'Open the scheduled job' : 'Open the request', jobHref, 'green'),
          note('Confirmed on the landlord’s property record link — no account needed on their side.'),
        ].join(''),
        { subject },
      ),
    });
  } catch (error) {
    console.error('[public-job] engineer renewal notification failed:', error);
  }
}
