'use server';

import { z } from 'zod';

import { supabaseServerReadOnly, supabaseServerServiceRole, getSupabaseUser } from '@/lib/supabaseServer';
import { CERTIFICATE_LABELS, type CertificateType } from '@/types/certificates';

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
});

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
      .select('id, invoice_number, status, issue_date, due_date, pdf_path, created_at')
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

export async function submitPublicJobRenewalRequest(input: z.infer<typeof RenewalRequestSchema>) {
  const request = RenewalRequestSchema.parse(input);
  const pageData = await getPublicJobByToken(request.token);
  if (!pageData) throw new Error('Job not found');

  const admin = await supabaseServerServiceRole();
  const { data: job, error: jobErr } = await admin
    .from('jobs')
    .select('id, user_id')
    .eq('public_token', request.token)
    .maybeSingle();
  if (jobErr) throw new Error(jobErr.message);
  if (!job) throw new Error('Job not found');
  const { error } = await fromJobRequests(admin).insert({
    source_job_id: pageData.jobId,
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
    preferred_dates: request.preferredDates || null,
    status: 'pending',
  });
  if (error) {
    if (error.code === '42P01') throw new Error('Renewal requests are not configured yet.');
    throw new Error(error.message);
  }

  return {
    ok: true,
    engineer: pageData.engineer,
  };
}
