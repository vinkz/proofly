import Image from 'next/image';
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
    <main className="min-h-screen bg-[var(--muted)] px-4 py-6 text-gray-900 sm:px-6">
      <section className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-2xl border border-white/10 bg-[var(--surface)]/90 p-6 shadow-md backdrop-blur">
          <Image src="/certnow-logo.svg" alt="certnow" width={150} height={34} priority />
          <h1 className="mt-4 text-3xl font-bold text-[var(--brand)]">Complete job details</h1>
          <p className="mt-2 text-sm text-muted-foreground/80">
            Your engineer needs these details to prepare the job before the visit.
          </p>
          {job.address || job.clientName || job.title ? (
            <div className="mt-4 rounded-2xl bg-white/70 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-950">{job.title ?? job.clientName ?? 'Requested job'}</p>
              {job.address ? <p className="mt-1">{job.address}</p> : null}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/95 p-6 shadow">
          <PrefillClient jobId={jobId} token={token} />
        </div>
      </section>
    </main>
  );
}
