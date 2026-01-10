import { notFound } from 'next/navigation';

import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { PdfPreview } from '@/components/certificates/pdf-preview';
import { DocumentActions } from './_components/document-actions';
import { isUUID } from '@/lib/ids';
import { getCertificatePdfSignedUrl, getCertificateState } from '@/server/certificates';
import { listInvoicesForJob } from '@/server/invoices';
import type { Database } from '@/lib/database.types';

export default async function JobPdfPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ url?: string }>;
}) {
  const { id } = await params;
  const qs = await searchParams;
  if (!isUUID(id)) notFound();

  const supabase = await supabaseServerReadOnly();
  const [
    { data: certificate, error: certificateError },
    { data: job, error: jobError },
    { data: report, error: reportError },
    invoices,
  ] = await Promise.all([
    supabase
      .from('certificates')
      .select('id, job_id, pdf_path, pdf_url, created_at')
      .eq('job_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
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

  let pdfUrl: string | null = null;
  let pdfError: string | null = null;
  let pdfPath: string | null = null;

  if (qs.url) {
    pdfUrl = qs.url;
  } else {
    const certificateState = await getCertificateState(certificate ?? null);
    if (!certificateError && certificateState !== 'missing') {
      try {
        const signed = await getCertificatePdfSignedUrl(id);
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-wide text-[var(--accent)]">Document Preview</p>
        <h1 className="text-2xl font-semibold text-muted">{title}</h1>
        <p className="text-sm text-muted-foreground/70">
          {jobRow.address ?? 'Address pending'}
        </p>
      </div>

      <DocumentActions
        jobId={id}
        pdfUrl={pdfUrl}
        pdfPath={pdfPath}
        invoiceId={invoice?.id ?? null}
      />
      <PdfPreview url={pdfUrl} error={pdfError} />
    </div>
  );
}
