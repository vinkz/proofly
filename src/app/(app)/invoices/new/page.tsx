import Link from 'next/link';
import { redirect } from 'next/navigation';

import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { createInvoiceForJob } from '@/server/invoices';
import { CreateInvoiceButton } from './_components/create-invoice-button';

type JobSummary = {
  id: string;
  client_name: string | null;
  address: string | null;
  title: string | null;
  status: string | null;
  created_at: string | null;
  job_code?: string | null;
};

type CertificateSummary = {
  job_id: string | null;
  pdf_path: string | null;
  pdf_url: string | null;
};

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string; guided?: string }>;
}) {
  const supabase = await supabaseServerReadOnly();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Invoices table is not in generated types yet; use an untyped handle for this page.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anySupabase = supabase as any;
  const { jobId, guided } = await searchParams;
  if (jobId) {
    const { data: existing, error: existingErr } = await anySupabase
      .from('invoices')
      .select('id')
      .eq('job_id', jobId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingErr) throw new Error(existingErr.message);
    if (existing?.id) redirect(`/invoices/${existing.id}`);

    const invoice = await createInvoiceForJob(jobId);
    redirect(`/invoices/${invoice.id}`);
  }

  if (guided === '1') {
    return (
      <div className="min-h-full">
        <div className="border-b-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
          <div className="mx-auto flex max-w-2xl items-center gap-3 px-[18px] py-[14px]">
            <Link
              href="/dashboard"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[0.5px] border-[var(--color-border-secondary)] text-[var(--color-text-secondary)]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span className="sr-only">Back</span>
            </Link>
            <h1 className="text-[20px] font-medium text-[var(--color-text-primary)]">Create invoice</h1>
          </div>
        </div>
        <div className="mx-auto max-w-2xl px-4 py-6">
          <p className="text-[14px] text-[var(--color-text-secondary)]">
            Invoices are issued at the end of a job. Start a new job to get started.
          </p>
          <div className="mt-4 flex gap-2">
            <Link
              href="/jobs/new"
              className="inline-flex h-10 items-center justify-center rounded-[24px] bg-[#111] px-5 text-[13px] font-medium text-white"
            >
              Start a new job
            </Link>
            <Link
              href="/jobs"
              className="inline-flex h-10 items-center justify-center rounded-[24px] border-[0.5px] border-[var(--color-border-secondary)] px-5 text-[13px] font-medium text-[var(--color-text-secondary)]"
            >
              View jobs
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { data: jobs, error: jobsErr } = await (anySupabase
    .from('jobs')
    .select('id, client_name, address, title, status, created_at, job_code')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50) as Promise<{ data: JobSummary[] | null; error: { message: string } | null }>);
  if (jobsErr) throw new Error(jobsErr.message);

  const jobRows = jobs ?? [];
  const jobIds = jobRows.map((job) => job.id);
  const [certificates, photos] = await Promise.all([
    jobIds.length
      ? supabase
          .from('certificates')
          .select('job_id, pdf_path, pdf_url')
          .in('job_id', jobIds)
      : Promise.resolve({ data: [] as CertificateSummary[] }),
    jobIds.length
      ? supabase
          .from('job_photos')
          .select('job_id')
          .in('job_id', jobIds)
      : Promise.resolve({ data: [] as Array<{ job_id: string | null }> }),
  ]);

  const certRows = (certificates.data ?? []) as CertificateSummary[];
  const certMap = new Map<string, CertificateSummary>();
  certRows.forEach((row) => {
    if (row.job_id) certMap.set(row.job_id, row);
  });

  const photoCount = (photos.data ?? []).reduce<Record<string, number>>((acc, row) => {
    if (!row.job_id) return acc;
    acc[row.job_id] = (acc[row.job_id] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-full">
      {/* Page-level header */}
      <div className="border-b-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-[18px] py-[14px]">
          <Link
            href="/invoices"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[0.5px] border-[var(--color-border-secondary)] text-[var(--color-text-secondary)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span className="sr-only">Back to invoices</span>
          </Link>
          <h1 className="text-[20px] font-medium text-[var(--color-text-primary)]">Choose a job</h1>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-3 px-4 py-4">
        {jobRows.length === 0 ? (
          <div className="rounded-[16px] border-[0.5px] border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-6 text-center">
            <p className="text-[15px] font-medium text-[var(--color-text-primary)]">No jobs yet</p>
            <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">Create a job to start an invoice.</p>
            <Link
              href="/jobs/new"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-[24px] bg-[#111] px-5 text-[13px] font-medium text-white"
            >
              New job
            </Link>
          </div>
        ) : (
          jobRows.map((job) => {
            const cert = certMap.get(job.id);
            const hasCertificate = Boolean(cert?.pdf_path ?? cert?.pdf_url);
            const count = photoCount[job.id] ?? 0;
            return (
              <div
                key={job.id}
                className="overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]"
              >
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-[var(--color-text-primary)]">
                      {job.title ?? job.client_name ?? 'Job'}
                    </p>
                    {job.address ? (
                      <p className="mt-0.5 truncate text-[12px] text-[var(--color-text-secondary)]">{job.address}</p>
                    ) : null}
                    <div className="mt-1 flex flex-wrap gap-2 text-[12px] text-[var(--color-text-tertiary)]">
                      <span>{hasCertificate ? 'Certificate ready' : 'No certificate'}</span>
                      {count > 0 ? <span>{count} photo{count === 1 ? '' : 's'}</span> : null}
                    </div>
                  </div>
                  <CreateInvoiceButton jobId={job.id} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
