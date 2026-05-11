'use server';

import { supabaseServerAction } from '@/lib/supabaseServer';
import { CERTIFICATE_LABELS, type CertificateType } from '@/types/certificates';

type UntypedQuery = {
  select: (columns?: string) => UntypedQuery;
  eq: (column: string, value: unknown) => UntypedQuery;
  order: (column: string, options?: { ascending?: boolean }) => UntypedQuery;
  maybeSingle: () => Promise<{ data: unknown; error: { code?: string; message: string } | null }>;
};
type UntypedSupabase = { from: (table: string) => UntypedQuery };

const fromUntyped = (sb: unknown, table: string) => (sb as UntypedSupabase).from(table);

const getSiteUrl = () =>
  (process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || 'http://localhost:3000')
    .replace(/^([^h])/, 'https://$1')
    .replace(/\/$/, '');

export type JobHandoverBundle = {
  jobId: string;
  publicUrl: string | null;
  certificates: Array<{
    id: string;
    label: string;
    certType: string;
    pdfPath: string | null;
    pdfUrl: string | null;
  }>;
  invoice: {
    id: string;
    invoiceNumber: string | null;
    status: string | null;
    paymentStatus: string | null;
    paymentLinkUrl: string | null;
    pdfPath: string | null;
  } | null;
  readyToSend: boolean;
  missingParts: string[];
};

export async function getJobHandoverBundle(jobId: string): Promise<JobHandoverBundle> {
  const sb = await supabaseServerAction();
  const {
    data: { user },
    error: userError,
  } = await sb.auth.getUser();
  if (userError || !user) throw new Error(userError?.message ?? 'Unauthorized');

  const { data: job, error: jobError } = await sb
    .from('jobs')
    .select('id, user_id, public_token')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (jobError || !job) throw new Error(jobError?.message ?? 'Job not found');

  const [{ data: certificateRows, error: certificateError }, { data: invoiceRow, error: invoiceError }] = await Promise.all([
    sb
      .from('certificates')
      .select('id, cert_type, pdf_path, pdf_url, created_at')
      .eq('job_id', jobId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    fromUntyped(sb, 'invoices')
      .select('id, invoice_number, status, payment_status, payment_link_url, pdf_path, created_at')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .maybeSingle(),
  ]);
  if (certificateError) throw new Error(certificateError.message);
  if (invoiceError && invoiceError.code !== 'PGRST116') throw new Error(invoiceError.message);

  const certificates = (certificateRows ?? []).map((certificate) => {
    const certType = certificate.cert_type ?? 'certificate';
    return {
      id: certificate.id,
      label: CERTIFICATE_LABELS[certType as CertificateType] ?? certType.replaceAll('_', ' '),
      certType,
      pdfPath: certificate.pdf_path ?? null,
      pdfUrl: certificate.pdf_url ?? null,
    };
  });

  const invoice = invoiceRow as Record<string, unknown> | null;
  const publicUrl = job.public_token ? `${getSiteUrl()}/j/${job.public_token}` : null;
  const missingParts = [
    ...(certificates.length ? [] : ['certificate PDF']),
    ...(invoice ? [] : ['invoice']),
    ...(invoice?.pdf_path || invoice?.payment_link_url ? [] : ['invoice PDF or payment link']),
    ...(publicUrl ? [] : ['public job link']),
  ];

  return {
    jobId,
    publicUrl,
    certificates,
    invoice: invoice
      ? {
          id: String(invoice.id ?? ''),
          invoiceNumber: typeof invoice.invoice_number === 'string' ? invoice.invoice_number : null,
          status: typeof invoice.status === 'string' ? invoice.status : null,
          paymentStatus: typeof invoice.payment_status === 'string' ? invoice.payment_status : null,
          paymentLinkUrl: typeof invoice.payment_link_url === 'string' ? invoice.payment_link_url : null,
          pdfPath: typeof invoice.pdf_path === 'string' ? invoice.pdf_path : null,
        }
      : null,
    readyToSend: missingParts.length === 0,
    missingParts,
  };
}

