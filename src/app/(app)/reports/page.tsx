import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { ShareReportLinkButton } from '@/components/report/share-link-button';

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const query = params.q?.toLowerCase() ?? '';
  const supabase = await supabaseServerReadOnly();
  const { data } = await supabase
    .from('reports')
    .select('id, job_id, storage_path, generated_at, created_at, jobs:jobs(client_name, title, status, scheduled_for)')
    .order('generated_at', { ascending: false });
  const reports = (data ?? []).filter((report) => {
    if (!query) return true;
    const job = report.jobs;
    const haystack = [report.job_id, job?.client_name, job?.title].join(' ').toLowerCase();
    return haystack.includes(query);
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-wide text-[var(--accent)]">Archive</p>
        <h1 className="text-3xl font-semibold text-muted">Reports</h1>
        <p className="text-sm text-muted-foreground/70">Search, preview, and share generated PDFs.</p>
      </header>

      <form className="rounded-3xl border border-white/20 bg-white/80 p-4" action="/reports" method="get">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Search by client or job ID..."
          className="w-full rounded-full border border-white/40 px-4 py-2 text-sm"
        />
      </form>

      <div className="rounded-3xl border border-white/20 bg-white/90 p-4">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-muted-foreground/60">
              <th className="px-3 py-2 text-left">Client</th>
              <th className="px-3 py-2 text-left">Job</th>
              <th className="px-3 py-2 text-left">Generated</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {reports.map((report) => (
              <tr key={report.job_id}>
                <td className="px-3 py-3 font-semibold text-muted">{report.jobs?.client_name ?? 'Client'}</td>
                <td className="px-3 py-3 text-muted-foreground/80">{report.jobs?.title ?? 'Untitled job'}</td>
                <td className="px-3 py-3 text-muted-foreground/60">
                  {report.generated_at ? new Date(report.generated_at).toLocaleString() : 'Pending'}
                </td>
                <td className="px-3 py-3 text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    <a
                      href={`/reports/${report.job_id}`}
                      className="rounded-full border border-white/30 px-3 py-1 text-xs text-muted-foreground/80 hover:bg-white/70"
                    >
                      Open
                    </a>
                    <ShareReportLinkButton jobId={report.job_id} />
                  </div>
                </td>
              </tr>
            ))}
            {reports.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-sm text-muted-foreground/70">
                  No reports found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
