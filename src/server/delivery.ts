'use server';

import { revalidatePath } from 'next/cache';
import { Buffer } from 'node:buffer';

import type { Database } from '@/lib/database.types';
import { sendEmail } from '@/lib/resend';
import { requireUser, supabaseServerServiceRole } from '@/lib/supabaseServer';
import { promoteDeliveredJobData } from '@/server/delivery-promotion';
import { persistJobFields, type JobFieldEntry } from '@/server/job-fields';
import { CERTIFICATE_LABELS, type CertificateType } from '@/types/certificates';

export type DeliveryRecipient = 'landlord' | 'tenant' | 'both';

export type DeliveryCertificate = {
  id: string;
  certType: string;
  label: string;
  issuedAt: string | null;
  /** Short-lived signed URL for preview/download */
  previewUrl: string | null;
};

export type DeliveryBundle = {
  jobId: string;
  address: string;
  publicToken: string;
  publicHref: string;
  landlordName: string | null;
  landlordEmail: string | null;
  tenantName: string | null;
  tenantEmail: string | null;
  engineerName: string | null;
  engineerEmail: string | null;
  certificates: DeliveryCertificate[];
  hasInvoice: boolean;
  invoiceStatus: string | null;
};

export type SendDeliveryResult = {
  ok: boolean;
  recipientsSent: string[];
  error?: string;
};

export type UpdateDeliveryRecipientEmailsResult = {
  ok: boolean;
  error?: string;
};

type FieldRow = { field_key: string | null; value: string | null };
type CertificateRow = {
  id: string;
  cert_type: string | null;
  issued_at: string | null;
  created_at: string | null;
  pdf_path: string | null;
  pdf_url: string | null;
};
type InvoiceRow = { id: string; status: string | null; pdf_path: string | null };
type UntypedQuery = {
  select: (columns?: string) => UntypedQuery;
  eq: (column: string, value: unknown) => UntypedQuery;
  order: (column: string, options?: { ascending?: boolean }) => UntypedQuery;
  limit: (count: number) => UntypedQuery;
  maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
};
type UntypedSupabase = { from: (table: string) => UntypedQuery };

const getSiteUrl = () =>
  (
    process.env.NEXT_PUBLIC_SHARE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    'https://certnow.uk'
  ).replace(/\/$/, '');

const pickText = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return '';
};

const formatCertificateLabel = (certType: string) =>
  CERTIFICATE_LABELS[certType as CertificateType] ?? certType.replaceAll('_', ' ');

const formatIssuedDate = (value: string | null) => {
  if (!value) return 'date not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const uniqueRecipients = (values: Array<string | null>) => {
  const seen = new Set<string>();
  return values
    .map((value) => value?.trim() ?? '')
    .filter((value) => {
      if (!value) return false;
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const filenameForCertificate = (label: string) => `${label.replace(/[^a-z0-9]/gi, '_')}.pdf`;

const normalizeOptionalEmail = (value: string | null | undefined) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('Enter a valid email address.');
  }
  return normalized;
};

export async function updateDeliveryRecipientEmails(
  jobId: string,
  input: { landlordEmail?: string | null; tenantEmail?: string | null },
): Promise<UpdateDeliveryRecipientEmailsResult> {
  try {
    const { sb, user } = await requireUser({ write: true });
    const landlordEmail = normalizeOptionalEmail(input.landlordEmail);
    const tenantEmail = normalizeOptionalEmail(input.tenantEmail);

    const { data: job, error: jobErr } = await sb
      .from('jobs')
      .select('id, user_id, client_id')
      .eq('id', jobId as Database['public']['Tables']['jobs']['Row']['id'])
      .maybeSingle();
    if (jobErr) throw new Error(jobErr.message);
    if (!job) throw new Error('Job not found');
    if (job.user_id !== user.id) throw new Error('Unauthorized');

    const entries: JobFieldEntry[] = [];
    if (landlordEmail) {
      entries.push(
        { job_id: jobId, field_key: 'landlord_email', value: landlordEmail },
        { job_id: jobId, field_key: 'customer_email', value: landlordEmail },
      );
    }
    if (tenantEmail) {
      entries.push({ job_id: jobId, field_key: 'tenant_email', value: tenantEmail });
    }

    if (entries.length) {
      await persistJobFields(sb, jobId, entries, 'updateDeliveryRecipientEmails');
    }

    if (landlordEmail && job.client_id) {
      await sb
        .from('clients')
        .update({ email: landlordEmail })
        .eq('id', job.client_id as Database['public']['Tables']['clients']['Row']['id'])
        .eq('user_id', user.id);
    }

    revalidatePath(`/jobs/${jobId}/deliver`);
    revalidatePath(`/jobs/${jobId}/complete`);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not save recipient email.',
    };
  }
}

/**
 * Assembles the delivery bundle for a job: final certificates with signed URLs,
 * recipient contact details, and public share link.
 * Implemented by Codex (Milestone 5 server actions).
 */
export async function buildDeliveryBundle(jobId: string): Promise<DeliveryBundle> {
  const { sb, user } = await requireUser();
  const admin = await supabaseServerServiceRole();

  const { data: job, error: jobErr } = await sb
    .from('jobs')
    .select('id, title, address, client_name, status, public_token, user_id, client_id, property_id')
    .eq('id', jobId as Database['public']['Tables']['jobs']['Row']['id'])
    .maybeSingle();
  if (jobErr) throw new Error(jobErr.message);
  if (!job) throw new Error('Job not found');
  if (job.user_id !== user.id) throw new Error('Unauthorized');

  const [{ data: certificateRows, error: certErr }, { data: fieldRows, error: fieldsErr }, profileResp, clientResp, invoiceResp, propertyResp] =
    await Promise.all([
      admin
        .from('certificates')
        .select('id, cert_type, issued_at, created_at, pdf_path, pdf_url')
        .eq('job_id', jobId)
        .not('pdf_path', 'is', null)
        .order('created_at', { ascending: true }),
      admin.from('job_fields').select('field_key, value').eq('job_id', jobId),
      admin
        .from('profiles')
        .select('default_engineer_name, full_name, company_email, gas_safe_number')
        .eq('id', job.user_id ?? '')
        .maybeSingle(),
      job.client_id
        ? admin.from('clients').select('name, email').eq('id', job.client_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      (sb as unknown as UntypedSupabase)
        .from('invoices')
        .select('id, status, pdf_path')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      job.property_id
        ? admin
            .from('properties')
            .select('public_token')
            .eq('id', job.property_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

  if (certErr) throw new Error(certErr.message);
  if (fieldsErr) throw new Error(fieldsErr.message);
  if (profileResp.error) throw new Error(profileResp.error.message);
  if (clientResp.error) throw new Error(clientResp.error.message);
  if (invoiceResp.error) throw new Error(invoiceResp.error.message);
  if (propertyResp.error) throw new Error(propertyResp.error.message);

  const certificates: DeliveryCertificate[] = await Promise.all(
    ((certificateRows ?? []) as CertificateRow[]).map(async (certificate) => {
      const pdfPath = certificate.pdf_path;
      let previewUrl: string | null = certificate.pdf_url ?? null;
      if (pdfPath) {
        const { data, error } = await admin.storage.from('certificates').createSignedUrl(pdfPath, 3600);
        if (error) throw new Error(error.message);
        previewUrl = data?.signedUrl ?? previewUrl;
      }
      const certType = certificate.cert_type ?? 'certificate';
      return {
        id: certificate.id,
        certType,
        label: formatCertificateLabel(certType),
        issuedAt: certificate.issued_at ?? certificate.created_at ?? null,
        previewUrl,
      };
    }),
  );

  const fieldMap = Object.fromEntries(
    ((fieldRows ?? []) as FieldRow[]).map((row) => [row.field_key ?? '', row.value ?? null]),
  ) as Record<string, string | null>;
  const profile = profileResp.data;
  const client = clientResp.data;
  const invoice = invoiceResp.data as InvoiceRow | null;
  const property = propertyResp.data as { public_token: string } | null;
  const constructedAddress = [
    fieldMap.job_address_line1,
    fieldMap.job_address_city,
    fieldMap.job_postcode,
  ].filter(Boolean).join(', ');
  const address = pickText(fieldMap.property_address, constructedAddress, job.address, 'Property address not recorded');
  const publicToken = job.public_token;
  const publicHref = property?.public_token ? `/p/${property.public_token}` : `/j/${publicToken}`;

  return {
    jobId: job.id,
    address,
    publicToken,
    publicHref,
    landlordName: pickText(fieldMap.landlord_name, client?.name ?? null, job.client_name) || null,
    landlordEmail: pickText(fieldMap.landlord_email, client?.email ?? null) || null,
    tenantName: pickText(fieldMap.tenant_name) || null,
    tenantEmail: pickText(fieldMap.tenant_email) || null,
    engineerName: pickText(profile?.default_engineer_name ?? null, profile?.full_name ?? null) || null,
    engineerEmail: pickText(profile?.company_email ?? null) || null,
    certificates,
    hasInvoice: Boolean(invoice),
    invoiceStatus: invoice?.status ?? null,
  };
}

/**
 * Sends the delivery bundle via Resend email.
 * Attaches certificate PDFs, sets Reply-To to engineer email,
 * includes /j/[publicToken] link in body.
 * On success: marks job status = 'delivered', sets delivered_at = now().
 * Implemented by Codex (Milestone 5 server actions).
 */
export async function sendDeliveryBundle(
  jobId: string,
  recipients: DeliveryRecipient,
  method: 'email',
): Promise<SendDeliveryResult> {
  if (method !== 'email') return { ok: false, recipientsSent: [], error: 'Unsupported delivery method.' };

  const { sb, user } = await requireUser({ write: true });

  // Promote job data to properties/clients before building bundle so that
  // the delivery email can reference the /p/ vault URL if promotion succeeds.
  try {
    await promoteDeliveredJobData({ jobId, userId: user.id });
  } catch {
    // Promotion failure is non-fatal — email delivery still proceeds.
  }

  const bundle = await buildDeliveryBundle(jobId);
  const recipientEmails = uniqueRecipients(
    recipients === 'landlord'
      ? [bundle.landlordEmail]
      : recipients === 'tenant'
        ? [bundle.tenantEmail]
        : [bundle.landlordEmail, bundle.tenantEmail],
  );

  if (recipientEmails.length === 0) {
    return { ok: false, recipientsSent: [], error: 'No email address on file for selected recipients.' };
  }

  try {
    const attachments = await Promise.all(
      bundle.certificates
        .filter((certificate) => Boolean(certificate.previewUrl))
        .map(async (certificate) => {
          const response = await fetch(certificate.previewUrl as string);
          if (!response.ok) {
            throw new Error(`Could not download ${certificate.label} PDF for attachment.`);
          }
          const buffer = await response.arrayBuffer();
          return {
            filename: filenameForCertificate(certificate.label),
            content: Buffer.from(buffer).toString('base64'),
          };
        }),
    );

    const publicUrl = `${getSiteUrl()}${bundle.publicHref}`;
    const includedCertificates = bundle.certificates
      .map((certificate) => `- ${certificate.label} (Issued ${formatIssuedDate(certificate.issuedAt)})`)
      .join('\n');
    const greetingName = bundle.landlordName || 'there';
    const engineerName = bundle.engineerName || 'CertNow';
    const subject = `Gas Safety Certificate — ${bundle.address}`;
    const text = [
      `Hi ${greetingName},`,
      '',
      `Please find your gas safety certificate(s) for ${bundle.address} attached.`,
      '',
      'You can also view and download your documents online (no login required):',
      publicUrl,
      '',
      'Certificate(s) included:',
      includedCertificates || '- Certificate PDF',
      '',
      'Regards,',
      engineerName,
    ].join('\n');
    const html = [
      `<p>Hi ${escapeHtml(greetingName)},</p>`,
      `<p>Please find your gas safety certificate(s) for ${escapeHtml(bundle.address)} attached.</p>`,
      `<p>You can also view and download your documents online (no login required):<br><a href="${escapeHtml(publicUrl)}">${escapeHtml(publicUrl)}</a></p>`,
      '<p>Certificate(s) included:</p>',
      `<ul>${bundle.certificates
        .map(
          (certificate) =>
            `<li>${escapeHtml(certificate.label)} (Issued ${escapeHtml(formatIssuedDate(certificate.issuedAt))})</li>`,
        )
        .join('') || '<li>Certificate PDF</li>'}</ul>`,
      `<p>Regards,<br>${escapeHtml(engineerName)}</p>`,
    ].join('');

    const result = await sendEmail({
      to: recipientEmails,
      subject,
      replyTo: bundle.engineerEmail ?? undefined,
      text,
      html,
      attachments,
    });

    if (result.status !== 'sent') {
      return {
        ok: false,
        recipientsSent: [],
        error: result.error ?? `Email delivery ${result.status}`,
      };
    }

    const deliveredAt = new Date().toISOString();
    const { error: updateErr } = await sb
      .from('jobs')
      .update({ status: 'delivered', delivered_at: deliveredAt })
      .eq('id', jobId as Database['public']['Tables']['jobs']['Row']['id']);
    if (updateErr) throw new Error(updateErr.message);

    revalidatePath('/dashboard');
    revalidatePath(`/jobs/${jobId}/complete`);
    return { ok: true, recipientsSent: recipientEmails };
  } catch (error) {
    return {
      ok: false,
      recipientsSent: [],
      error: error instanceof Error ? error.message : 'Could not send delivery bundle.',
    };
  }
}
