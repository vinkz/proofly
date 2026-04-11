import { notFound } from 'next/navigation';
import Link from 'next/link';

import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { PdfPreview } from '@/components/certificates/pdf-preview';
import { DocumentActions } from './_components/document-actions';
import { DocumentBackButton } from './_components/back-button';
import { isUUID } from '@/lib/ids';
import { getCertificatePdfSignedUrl, getCertificateState } from '@/server/certificates';
import type { Database } from '@/lib/database.types';
import { CERTIFICATE_TYPES, type CertificateType } from '@/types/certificates';
import {
  buildCertificateEditHref,
  buildCertificateResumeHref,
  getDefaultEditStepForJobType,
  getDefaultEditStepForCertificateType,
  getResumeStepFromRecord,
} from '@/lib/certificate-resume';

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
    { data: jobRecord },
    { data: referenceFields },
    { data: gasWarningNoticeJobs },
    { data: report, error: reportError },
  ] = await Promise.all([
    certificateQuery.maybeSingle(),
    supabase.from('jobs').select('*').eq('id', id).maybeSingle(),
    supabase.from('job_records').select('record').eq('job_id', id).maybeSingle(),
    supabase
      .from('job_fields')
      .select('field_key, value')
      .eq('job_id', id)
      .in('field_key', ['record_id', 'certificate_number']),
    supabase
      .from('jobs')
      .select('id, status, title, source_appliance_key')
      .eq('parent_job_id', id)
      .eq('certificate_type', 'gas_warning_notice')
      .order('created_at', { ascending: true }),
    supabase
      .from('reports')
      .select('id, job_id, storage_path, created_at')
      .eq('job_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (jobError) throw new Error(jobError.message);
  if (!job) notFound();
  const jobRow = job as Database['public']['Tables']['jobs']['Row'];

  let pdfUrl: string | null = null;
  let pdfError: string | null = null;

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
    } else if (report?.storage_path) {
      const { data, error } = await supabase.storage.from('reports').createSignedUrl(report.storage_path, 60 * 10);
      if (error || !data?.signedUrl) {
        pdfError = error?.message ?? 'Unable to load PDF.';
      } else {
        pdfUrl = data.signedUrl;
      }
    } else {
      pdfError = certificateError?.message ?? reportError?.message ?? 'No PDF found for this job';
    }
  }

  const title = jobRow.title ?? 'Document';
  const referenceFieldMap = Object.fromEntries(
    (referenceFields ?? []).map((row) => [row.field_key ?? '', row.value ?? null]),
  );
  const certificateReference =
    typeof referenceFieldMap.record_id === 'string' && referenceFieldMap.record_id.trim().length
      ? referenceFieldMap.record_id.trim()
        : typeof referenceFieldMap.certificate_number === 'string' && referenceFieldMap.certificate_number.trim().length
          ? referenceFieldMap.certificate_number.trim()
          : null;
  const linkedGasWarningNoticeJobs = (gasWarningNoticeJobs ?? []) as Array<{
    id: string;
    status: string | null;
    title: string | null;
    source_appliance_key: string | null;
  }>;
  const showGasWarningNoticeCta =
    (selectedCertificateType === 'cp12' || certificate?.cert_type === 'cp12') && linkedGasWarningNoticeJobs.length > 0;
  const firstGasWarningNoticeJob = linkedGasWarningNoticeJobs[0] ?? null;
  const resumeRecord = jobRecord?.record as Record<string, unknown> | null | undefined;
  const resumeCertificateType =
    typeof resumeRecord?.resume_certificate_type === 'string' ? resumeRecord.resume_certificate_type : null;
  const resumeStep = getResumeStepFromRecord(resumeRecord);
  const editStep =
    selectedCertificateType && resumeCertificateType === selectedCertificateType
      ? resumeStep
      : getDefaultEditStepForCertificateType(selectedCertificateType);
  const backHref = selectedCertificateType
    ? buildCertificateEditHref({
        jobId: id,
        certificateType: selectedCertificateType,
        startStep: editStep,
      })
    : buildCertificateResumeHref({
        jobId: id,
        jobType: jobRow.job_type,
        startStep: resumeStep ?? getDefaultEditStepForJobType(jobRow.job_type),
      });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <DocumentBackButton href={backHref} />
        <h1 className="text-2xl font-semibold text-muted">{title}</h1>
        {certificateReference ? (
          <p className="text-sm font-medium text-muted-foreground/80">Certificate ref: {certificateReference}</p>
        ) : null}
        <p className="text-sm text-muted-foreground/70">Saved to Jobs. You can find this again under Past jobs.</p>
        <p className="text-sm text-muted-foreground/70">
          {jobRow.address ?? 'Address pending'}
        </p>
      </div>

      {showGasWarningNoticeCta && firstGasWarningNoticeJob ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-sm font-semibold text-amber-950">Unsafe appliance follow-up required</p>
          <p className="mt-1 text-sm text-amber-900/80">
            A linked Gas Warning Notice draft is ready for this CP12.
          </p>
          <Link
            href={`/wizard/create/gas_warning_notice?jobId=${firstGasWarningNoticeJob.id}`}
            className="mt-3 inline-flex rounded-full bg-[var(--action)] px-4 py-2 text-sm font-semibold text-white shadow-sm"
          >
            Issue Gas Warning Notice
          </Link>
        </div>
      ) : null}

      <DocumentActions
        pdfUrl={pdfUrl}
      />
      <PdfPreview url={pdfUrl} error={pdfError} />
    </div>
  );
}
