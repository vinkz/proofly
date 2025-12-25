import Link from 'next/link';
import Image from 'next/image';
import { notFound, redirect } from 'next/navigation';

import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { getJobWithChecklist, markJobComplete } from '@/server/jobs';
import type { JobDetailPayload } from '@/types/job-detail';
import { ChecklistItemCard } from '@/components/checklist-item-card';
import { SignatureModal } from '@/components/signature-modal';
import { GenerateReportButton } from '@/components/report/generate-report-button';
import { ShareReportLinkButton } from '@/components/report/share-link-button';
import { JobProgressProvider } from '@/components/job-progress-context';
import { JobProgressBar } from '@/components/job-progress-bar';
import { DeleteJobButton } from '@/components/jobs/delete-job-button';
import { GenerateJobSheetButton } from '@/components/jobs/generate-job-sheet-button';
import { Button } from '@/components/ui/button';
import type { Database } from '@/lib/database.types';
import { isUUID } from '@/lib/ids';
import { reportKindForJobType } from '@/types/reports';
import type { CertificateType } from '@/types/certificates';

type ChecklistResult = Database['public']['Tables']['job_items']['Row']['result'];

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ resume?: string }>;
}) {
  const { id: jobId } = await params;
  const resolvedSearch = await searchParams;
  const resumeParam = typeof resolvedSearch?.resume === 'string' ? resolvedSearch.resume : null;
  const showResume = resumeParam === '1' || resumeParam === 'true';
  if (!isUUID(jobId)) {
    notFound();
  }
  let data: JobDetailPayload;
  const supabase = await supabaseServerReadOnly();

  try {
    data = await getJobWithChecklist(jobId);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        redirect('/login');
      }
      if (error.message === 'Job not found') {
        notFound();
      }
    }
    throw error;
  }

  const { job, items, photos, signatures, report } = data;
  const clientName = job.client_name ?? 'Client';
  const jobAddress = job.address ?? 'No address provided';
  const jobStatus = job.status ?? 'pending';
  const createdLabel = job.created_at ? new Date(job.created_at).toLocaleString() : 'Unknown';
  const reportKind = reportKindForJobType(job.job_type ?? null);
  const certificateActions = [
    { type: 'cp12', label: 'Start CP12', variant: 'primary' },
    { type: 'gas_service', label: 'Start Gas Service', variant: 'secondary' },
    { type: 'general_works', label: 'Start General Works', variant: 'secondary' },
    { type: 'breakdown', label: 'Gas Breakdown Record', variant: 'secondary' },
    { type: 'commissioning', label: 'Installation/Commissioning Checklist', variant: 'secondary' },
  ] satisfies Array<{ type: CertificateType; label: string; variant: 'primary' | 'secondary' }>;

  const photosWithUrls = await Promise.all(
    photos.map(async (photo) => {
      const { data: signed } = await supabase.storage.from('photos').createSignedUrl(photo.storage_path, 60 * 60);
      return {
        id: photo.id,
        checklist_id: photo.checklist_id,
        storage_path: photo.storage_path,
        signedUrl: signed?.signedUrl ?? null,
      };
    }),
  );

  const photosByChecklist = photosWithUrls.reduce<
    Record<string, { id: string; signedUrl: string | null; storage_path: string }[]>
  >((acc, photo) => {
    const key = photo.checklist_id ?? 'general';
    acc[key] = acc[key] ? [...acc[key], photo] : [photo];
    return acc;
  }, {});

  const plumberSignatureUrl = signatures?.plumber_sig_path
    ? (await supabase.storage.from('signatures').createSignedUrl(signatures.plumber_sig_path, 60 * 60)).data?.signedUrl ?? null
    : null;
  const clientSignatureUrl = signatures?.client_sig_path
    ? (await supabase.storage.from('signatures').createSignedUrl(signatures.client_sig_path, 60 * 60)).data?.signedUrl ?? null
    : null;

  const signaturePreviews: { signer: 'plumber' | 'client'; signedUrl: string | null }[] = [
    { signer: 'plumber', signedUrl: plumberSignatureUrl },
    { signer: 'client', signedUrl: clientSignatureUrl },
  ];

  let reportSignedUrl: string | null = null;
  if (report?.storage_path) {
    const { data: signed } = await supabase.storage.from('reports').createSignedUrl(report.storage_path, 600);
    reportSignedUrl = signed?.signedUrl ?? null;
  }

  const generalPhotos = photosByChecklist.general ?? [];

  const initialStatuses = Object.fromEntries(
    items.map((item) => [item.id, (item.result ?? 'pending') as ChecklistResult]),
  );

  const handleMarkComplete = async () => {
    'use server';
    await markJobComplete(jobId);
  };

  return (
    <JobProgressProvider initialStatuses={initialStatuses}>
      <main className="mx-auto max-w-5xl p-6">
        <JobProgressBar total={items.length} />
        <div className="flex flex-col gap-2 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/jobs" className="text-xs uppercase tracking-wide text-accent">
              ← Back to jobs
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-muted">{clientName}</h1>
            <p className="text-sm text-muted-foreground/70">{jobAddress}</p>
            <p className="text-xs text-muted-foreground/50">Opened {createdLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                jobStatus === 'completed' ? 'bg-brand/20 text-brand' : 'bg-accent/10 text-accent'
              }`}
            >
              {jobStatus}
            </span>
            <SignatureModal jobId={jobId} signatures={signaturePreviews} />
            <GenerateJobSheetButton jobId={jobId} />
            <GenerateReportButton jobId={jobId} reportKind={reportKind} />
            {reportSignedUrl ? (
              <Link
                href={reportSignedUrl}
                target="_blank"
                className="rounded-2xl border border-white/15 px-4 py-2 text-sm text-muted-foreground transition hover:bg-white/10 hover:text-muted"
              >
                View report
              </Link>
            ) : null}
            {report?.storage_path ? <ShareReportLinkButton jobId={jobId} /> : null}
            <DeleteJobButton jobId={jobId} />
          </div>
        </div>

        {showResume ? (
          <section className="mt-6 rounded-2xl border border-[var(--accent)]/40 bg-white/80 p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">Continue visit</p>
                <p className="text-base font-semibold text-muted">Pick up where you left off</p>
                <p className="text-xs text-muted-foreground/70">
                  Resume the visit with the most common actions.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild variant="secondary">
                  <Link href="#certificate-checks">Add photos</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href={`/jobs/new/${jobId}/details`}>Add note</Link>
                </Button>
                <Button asChild variant="primary">
                  <Link href="#certificates">Generate output</Link>
                </Button>
                {job.status && job.status !== 'completed' ? (
                  <form action={handleMarkComplete}>
                    <Button type="submit" variant="outline">
                      Mark job complete
                    </Button>
                  </form>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {job.notes ? (
          <section id="notes" className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Notes</h2>
            <p className="mt-2 text-sm text-muted-foreground/80">{job.notes}</p>
          </section>
        ) : null}

        <section id="certificates" className="mt-8 space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-muted">Certificates</h2>
            <p className="text-sm text-muted-foreground/70">Start a new certificate for this job.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {certificateActions.map((action) => (
              <Button key={action.type} asChild variant={action.variant} className="rounded-full">
                <Link href={`/wizard/create/${action.type}?jobId=${job.id}`}>{action.label}</Link>
              </Button>
            ))}
          </div>
        </section>

        <section id="certificate-checks" className="mt-8 space-y-4">
          <h2 className="text-lg font-semibold text-muted">Certificate checks</h2>
          {items.length ? (
            <div className="grid gap-4">
              {items.map((item, index) => (
                <ChecklistItemCard
                  key={item.id}
                  jobId={jobId}
                  item={item}
                  photos={photosByChecklist[item.id] ?? []}
                  nextItemId={items[index + 1]?.id ?? null}
                />
              ))}
            </div>
          ) : (
            <p className="rounded border border-dashed border-white/15 p-4 text-sm text-muted-foreground/70">
              Checks have not been recorded for this certificate.
            </p>
          )}
        </section>

        {generalPhotos.length ? (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-muted">General Photos</h2>
            <div className="mt-3 flex flex-wrap gap-3">
              {generalPhotos.map((photo) =>
                photo.signedUrl ? (
                  <Image
                    key={photo.id}
                    src={photo.signedUrl}
                    alt="Job photo"
                    width={96}
                    height={96}
                    unoptimized
                    className="h-24 w-24 rounded border border-white/15 object-cover"
                  />
                ) : null,
              )}
            </div>
          </section>
        ) : null}
      </main>
    </JobProgressProvider>
  );
}
