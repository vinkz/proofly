import { notFound } from 'next/navigation';

import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { PdfPreview } from '@/components/certificates/pdf-preview';
import { CERTIFICATE_LABELS, type CertificateType } from '@/types/certificates';
import { PdfActions } from './_components/pdf-actions';
import { isUUID } from '@/lib/ids';
import { getCertificatePdfSignedUrl, getCertificateState } from '@/server/certificates';
import { resolveCertificateType } from '@/server/certificate-type';

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

  const { certificateType, source } = await resolveCertificateType(id, job.certificate_type ?? null);
  console.log('[jobs/[id]/pdf] certificate type resolved', { jobId: id, certificateType, source, existingType: job.certificate_type });
  if (!certificateType) {
    return (
      <div className="space-y-4">
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
          <p className="text-lg font-semibold">Certificate type missing</p>
          <p className="mt-2 text-sm">
            This job does not have a certificate type set. Please contact support or recreate the job. Job ID: {id}
          </p>
        </div>
      </div>
    );
  }
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

      <PdfActions jobId={id} sentAt={null} certificateType={certificateType} />
      <PdfPreview url={pdfUrl} error={pdfError} />
    </div>
  );
}
