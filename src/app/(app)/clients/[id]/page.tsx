import { notFound } from 'next/navigation';

import { getClientDetail } from '@/server/clients';
import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { isUUID } from '@/lib/ids';
import { ShareReportLinkButton } from '@/components/report/share-link-button';
import { DeleteClientButton } from '@/components/clients/delete-client-button';
import { EditClientForm } from '@/components/clients/edit-client-form';
import { ClientCalendar } from '@/components/clients/client-calendar';

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUUID(id)) {
    notFound();
  }

  const detail = await getClientDetail(id);
  const supabase = await supabaseServerReadOnly();

  const signedReports = await Promise.all(
    detail.reports.map(async (report) => {
      const { data } = await supabase.storage.from('reports').createSignedUrl(report.storage_path, 60 * 5);
      return { job_id: report.job_id, url: data?.signedUrl ?? null };
    }),
  );

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-white/20 bg-white/80 p-6 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-[var(--accent)]">Client</p>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-muted">{detail.client.name}</h1>
            <p className="text-sm text-muted-foreground/70">{detail.client.organization ?? 'Individual'}</p>
          </div>
          <DeleteClientButton clientId={detail.client.id} />
        </div>
        <div className="mt-4 grid gap-3 text-sm text-muted-foreground/80 md:grid-cols-3">
          {detail.client.email ? <p>{detail.client.email}</p> : null}
          {detail.client.phone ? <p>{detail.client.phone}</p> : null}
          {detail.client.address ? <p>{detail.client.address}</p> : null}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-white/20 bg-white/80 p-5">
          <h2 className="text-lg font-semibold text-muted">Jobs</h2>
          <p className="text-xs text-muted-foreground/60">{detail.jobs.length} records</p>
          <ul className="mt-3 space-y-3 text-sm text-muted-foreground/80">
            {detail.jobs.map((job) => (
              <li key={job.id} className="rounded-2xl border border-white/20 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-muted">{job.title ?? 'Untitled job'}</p>
                    <p className="text-xs text-muted-foreground/60">
                      {job.scheduled_for ? new Date(job.scheduled_for).toLocaleString() : 'Not scheduled'}
                    </p>
                  </div>
                  <span className="rounded-full bg-muted/40 px-3 py-1 text-xs font-semibold uppercase text-muted-foreground/80">
                    {job.status ?? 'draft'}
                  </span>
                </div>
                <div className="mt-3 flex gap-2 text-xs">
                  <a
                    href={`/jobs/${job.id}`}
                    className="rounded-full border border-white/30 px-3 py-1 text-muted-foreground/70 hover:bg-white/70"
                  >
                    View job
                  </a>
                  <a
                    href={`/reports/${job.id}`}
                    className="rounded-full border border-white/30 px-3 py-1 text-muted-foreground/70 hover:bg-white/70"
                  >
                    Report
                  </a>
                </div>
              </li>
            ))}
            {detail.jobs.length === 0 ? (
              <li className="rounded-2xl border border-dashed border-white/30 p-4 text-sm text-muted-foreground/70">
                No jobs yet for this client.
              </li>
            ) : null}
          </ul>
        </div>
        <div className="rounded-3xl border border-white/20 bg-white/90 p-5">
          <h2 className="text-lg font-semibold text-muted">Reports</h2>
          <p className="text-xs text-muted-foreground/60">{detail.reports.length} generated</p>
          <ul className="mt-3 space-y-3">
            {detail.reports.map((report) => {
              const signed = signedReports.find((r) => r.job_id === report.job_id)?.url;
              return (
                <li key={report.job_id} className="rounded-2xl border border-white/20 p-4 text-sm text-muted-foreground/80">
                  <p>Job #{report.job_id.slice(0, 6)}…</p>
                  <p className="text-xs text-muted-foreground/60">
                    {report.generated_at ? new Date(report.generated_at).toLocaleString() : 'Pending'}
                  </p>
                  <div className="mt-2 flex gap-2">
                    {signed ? (
                      <a
                        href={signed}
                        target="_blank"
                        className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-white"
                      >
                        Download
                      </a>
                    ) : null}
                    <ShareReportLinkButton jobId={report.job_id} />
                  </div>
                </li>
              );
            })}
            {detail.reports.length === 0 ? (
              <li className="rounded-2xl border border-dashed border-white/30 p-4 text-sm text-muted-foreground/70">
                No reports generated yet.
              </li>
            ) : null}
          </ul>
        </div>
      </section>
      <section className="rounded-3xl border border-white/20 bg-white/90 p-5">
        <h2 className="text-lg font-semibold text-muted">Edit client</h2>
        <p className="text-xs text-muted-foreground/60">Update contact details and organization info.</p>
        <div className="mt-3">
          <EditClientForm client={detail.client} />
        </div>
      </section>
      <section className="rounded-3xl border border-white/20 bg-white/90 p-5">
        <ClientCalendar jobs={detail.jobs as any} />
      </section>
    </div>
  );
}
