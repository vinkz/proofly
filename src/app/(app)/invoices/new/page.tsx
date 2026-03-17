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
  searchParams: Promise<{ jobId?: string }>;
}) {
  const supabase = await supabaseServerReadOnly();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Invoices table is not in generated types yet; use an untyped handle for this page.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anySupabase = supabase as any;
  const { jobId } = await searchParams;
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
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <Link href="/dashboard" className="text-xs uppercase tracking-wide text-accent">
          ← Back to dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-muted">Create an invoice</h1>
        <p className="text-sm text-muted-foreground/70">
          Select a job to attach its certificate and photos.
        </p>
      </div>

      <div className="space-y-3">
        {jobRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/20 bg-white/40 p-6 text-sm text-muted-foreground/70">
            No jobs yet. Create a job to start an invoice.
          </div>
        ) : (
          jobRows.map((job) => {
            const cert = certMap.get(job.id);
            const hasCertificate = Boolean(cert?.pdf_path || cert?.pdf_url);
            const count = photoCount[job.id] ?? 0;
            return (
              <div key={job.id} className="rounded-2xl border border-white/10 bg-white/80 p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground/70">
                      {job.job_code ? `Job ${job.job_code}` : 'Job'}
                    </p>
                    <p className="text-lg font-semibold text-muted">{job.title ?? job.client_name ?? 'Job'}</p>
                    <p className="text-sm text-muted-foreground/70">{job.address ?? 'Address not set'}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground/70">
                      <span>{hasCertificate ? 'Certificate: ready' : 'Certificate: not generated'}</span>
                      <span>Photos: {count}</span>
                    </div>
                  </div>
                  <CreateInvoiceButton jobId={job.id} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
