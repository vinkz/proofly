import { notFound } from 'next/navigation';

import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { PdfPreview } from '@/components/certificates/pdf-preview';
import { CERTIFICATE_LABELS, type CertificateType } from '@/types/certificates';
import { PdfActions } from './_components/pdf-actions';
import { isUUID } from '@/lib/ids';
import { getCertificatePdfSignedUrl, getCertificateState } from '@/server/certificates';

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
  const [{ data: certificate, error: certificateError }, { data: job, error: jobError }] = await Promise.all([
    supabase.from('certificates').select('id, job_id, pdf_path, pdf_url, created_at').eq('job_id', id).maybeSingle(),
    supabase.from('jobs').select('certificate_type, title, address').eq('id', id).maybeSingle(),
  ]);
  if (jobError) throw new Error(jobError.message);
  if (!job) notFound();

  let pdfUrl: string | null = null;
  let pdfError: string | null = null;

  if (qs.url) {
    pdfUrl = qs.url;
  } else {
    const certificateState = await getCertificateState(certificate ?? null);
    if (certificateError) {
      pdfError = certificateError.message;
    } else if (certificateState === 'missing') {
      pdfError = 'No PDF found for this job';
    } else {
      try {
        const signed = await getCertificatePdfSignedUrl(id);
        pdfUrl = signed.url;
      } catch (error) {
        pdfError = error instanceof Error ? error.message : 'Unable to load PDF.';
      }
    }
  }

  const certificateType = (job.certificate_type ?? '') as CertificateType;
  const title = job.title ?? 'Certificate';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-wide text-[var(--accent)]">PDF preview</p>
        <h1 className="text-2xl font-semibold text-muted">{title}</h1>
        <p className="text-sm text-muted-foreground/70">
          {CERTIFICATE_LABELS[certificateType] ?? 'Certificate'} — {job?.address ?? 'Address pending'}
        </p>
      </div>

      <PdfActions jobId={id} sentAt={null} />
      <PdfPreview url={pdfUrl} error={pdfError} />
    </div>
  );
}
