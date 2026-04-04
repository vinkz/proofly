import { notFound } from 'next/navigation';

import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { PdfPreview } from '@/components/certificates/pdf-preview';
import { DocumentActions } from './_components/document-actions';
import { DocumentBackButton } from './_components/back-button';
import { isUUID } from '@/lib/ids';
import { getCertificatePdfSignedUrl, getCertificateState } from '@/server/certificates';
import { listInvoicesForJob } from '@/server/invoices';
import type { Database } from '@/lib/database.types';
import { CERTIFICATE_TYPES, type CertificateType } from '@/types/certificates';

const parseCertificateType = (value: string | undefined): CertificateType | null => {
  if (!value) return null;
  return CERTIFICATE_TYPES.includes(value as CertificateType) ? (value as CertificateType) : null;
};

export default async function JobPdfPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ url?: string; certificateType?: string }>;
}) {
  const { id } = await params;
  const qs = await searchParams;
  if (!isUUID(id)) notFound();
  const selectedCertificateType = parseCertificateType(qs.certificateType);

  const supabase = await supabaseServerReadOnly();
  let certificateQuery = supabase
    .from('certificates')
    .select('id, job_id, cert_type, pdf_path, pdf_url, created_at')
    .eq('job_id', id)
    .order('created_at', { ascending: false })
    .limit(1);
  if (selectedCertificateType) {
    certificateQuery = certificateQuery.eq('cert_type', selectedCertificateType);
  }
  const [
    { data: certificate, error: certificateError },
    { data: job, error: jobError },
    { data: report, error: reportError },
    invoices,
  ] = await Promise.all([
    certificateQuery.maybeSingle(),
    supabase.from('jobs').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('reports')
      .select('id, job_id, storage_path, created_at')
      .eq('job_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    listInvoicesForJob(id),
  ]);
  if (jobError) throw new Error(jobError.message);
  if (!job) notFound();
  const jobRow = job as Database['public']['Tables']['jobs']['Row'];
  const clientId = jobRow.client_id;
  const client =
    clientId && typeof clientId === 'string'
      ? (
          await supabase
            .from('clients')
            .select('id, name, email, phone')
            .eq('id', clientId)
            .maybeSingle()
        ).data
      : null;

  let pdfUrl: string | null = null;
  let pdfError: string | null = null;
  let pdfPath: string | null = null;

  if (qs.url) {
    pdfUrl = qs.url;
  } else {
    const certificateState = await getCertificateState(certificate ?? null);
    if (!certificateError && certificateState !== 'missing') {
      try {
        const signed = await getCertificatePdfSignedUrl({
          jobId: id,
          certificateType: selectedCertificateType ?? undefined,
        });
        pdfUrl = signed.url;
      } catch (error) {
        pdfError = error instanceof Error ? error.message : 'Unable to load PDF.';
      }
      if (certificate?.pdf_path) {
        pdfPath = certificate.pdf_path;
      } else if (certificate?.pdf_url && !certificate.pdf_url.startsWith('http')) {
        pdfPath = certificate.pdf_url;
      }
    } else if (report?.storage_path) {
      const { data, error } = await supabase.storage.from('reports').createSignedUrl(report.storage_path, 60 * 10);
      if (error || !data?.signedUrl) {
        pdfError = error?.message ?? 'Unable to load PDF.';
      } else {
        pdfUrl = data.signedUrl;
        pdfPath = report.storage_path;
      }
    } else {
      pdfError = certificateError?.message ?? reportError?.message ?? 'No PDF found for this job';
    }
  }

  const title = jobRow.title ?? 'Document';
  const invoice = invoices[0] ?? null;
  const hasDocument = Boolean(report?.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <DocumentBackButton fallbackHref={`/jobs/${id}`} />
        <p className="text-xs uppercase tracking-wide text-[var(--accent)]">Document Preview</p>
        <h1 className="text-2xl font-semibold text-muted">{title}</h1>
        <p className="text-sm text-muted-foreground/70">
          {jobRow.address ?? 'Address pending'}
        </p>
      </div>

      <DocumentActions
        jobId={id}
        jobTitle={title}
        pdfUrl={pdfUrl}
        pdfPath={pdfPath}
        invoiceId={invoice?.id ?? null}
        hasDocument={hasDocument}
        clientEmail={(client as { email?: string | null } | null)?.email ?? null}
        clientPhone={(client as { phone?: string | null } | null)?.phone ?? null}
      />
      <PdfPreview url={pdfUrl} error={pdfError} />
    </div>
  );
}
