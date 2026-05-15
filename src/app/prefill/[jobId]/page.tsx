import { notFound } from 'next/navigation';

import { getPrefillJobSummary } from '@/server/jobs';
import { PrefillClient } from './prefill-client';

export default async function PrefillJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams?: Promise<{ token?: string | string[] }>;
}) {
  const [{ jobId }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const token = Array.isArray(resolvedSearchParams?.token)
    ? resolvedSearchParams?.token[0]
    : resolvedSearchParams?.token;
  if (!token) notFound();

  const job = await getPrefillJobSummary(jobId, token);
  if (!job) notFound();

  return (
    <main className="min-h-screen bg-[var(--color-background-secondary)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-xl space-y-4">
        {/* Header */}
        <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-5 py-5">
          <p className="text-[18px] font-semibold leading-tight text-[var(--color-text-primary)] tracking-[-0.02em]">
            certnow
          </p>
          <h1 className="mt-3 text-[22px] font-semibold text-[var(--color-text-primary)] leading-tight">
            Send your job details
          </h1>
          <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
            Your engineer needs these details to prepare the job before the visit.
          </p>
          {job.address || job.clientName || job.title ? (
            <div className="mt-4 rounded-[10px] bg-[var(--color-background-secondary)] px-3 py-3">
              <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
                {job.title ?? job.clientName ?? 'Requested job'}
              </p>
              {job.address ? (
                <p className="mt-0.5 text-[12px] text-[var(--color-text-secondary)]">{job.address}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Form */}
        <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-5 py-5">
          <PrefillClient jobId={jobId} token={token} />
        </div>
      </div>
    </main>
  );
}
