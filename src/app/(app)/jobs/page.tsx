import type { Database } from '@/lib/database.types';
import { listJobs } from '@/server/jobs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type JobRow = Database['public']['Tables']['jobs']['Row'];

export default async function JobsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; month?: string }>;
}) {
  const params = await searchParams;
  const filterStatus = params.status ?? 'all';
  const filterMonth = params.month ?? '';

  const { active, completed } = await listJobs();
  const allJobs = [...(active as JobRow[]), ...(completed as JobRow[])];

  const filtered = allJobs.filter((job) => {
    const matchesStatus = filterStatus === 'all' ? true : job.status === filterStatus;
    const matchesMonth = filterMonth
      ? (job.scheduled_for ?? job.created_at ?? '').startsWith(filterMonth)
      : true;
    return matchesStatus && matchesMonth;
  });

  const upcoming = [...allJobs]
    .filter((job) => job.scheduled_for)
    .sort((a, b) => new Date(a.scheduled_for ?? '').getTime() - new Date(b.scheduled_for ?? '').getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--accent)]">Dispatch</p>
          <h1 className="text-3xl font-semibold text-muted">Jobs</h1>
          <p className="text-sm text-muted-foreground/70">Track every inspection from draft to report delivery.</p>
        </div>
        <Button asChild className="rounded-full bg-[var(--accent)] px-4 py-2 text-white">
          <a href="/jobs/new/client">New job</a>
        </Button>
      </header>

      <form className="grid gap-4 rounded-3xl border border-white/20 bg-white/80 p-4 shadow-sm md:grid-cols-3" action="/jobs" method="get">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
            Status
          </label>
          <select
            name="status"
            defaultValue={filterStatus}
            className="mt-1 w-full rounded-full border border-white/40 px-3 py-2 text-sm"
          >
            {['all', 'draft', 'active', 'awaiting_signatures', 'awaiting_report', 'completed'].map((status) => (
              <option key={status} value={status}>
                {status === 'awaiting_report' ? 'Awaiting report' : status.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
            Month
          </label>
          <Input type="month" name="month" defaultValue={filterMonth} className="mt-1" />
        </div>
        <div className="flex items-end justify-end">
          <Button type="submit" className="w-full rounded-full md:w-auto">
            Apply filters
          </Button>
        </div>
      </form>

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="rounded-3xl border border-white/20 bg-white/80 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-muted">Job list</h2>
              <p className="text-xs text-muted-foreground/60">{filtered.length} records</p>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-muted-foreground/60">
                  <th className="px-3 py-2 text-left">Client</th>
                  <th className="px-3 py-2 text-left">Title</th>
                  <th className="px-3 py-2 text-left">Scheduled</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Quick actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((job) => (
                  <tr key={job.id}>
                    <td className="px-3 py-3 font-semibold text-muted">{job.client_name}</td>
                    <td className="px-3 py-3 text-muted-foreground/80">{job.title ?? 'Untitled job'}</td>
                    <td className="px-3 py-3 text-muted-foreground/70">
                      {job.scheduled_for ? new Date(job.scheduled_for).toLocaleString() : 'Not scheduled'}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={job.status ?? 'draft'} />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {job.status === 'completed' ? (
                          <a
                            href={`/reports/${job.id}`}
                            className="rounded-full border border-white/30 px-3 py-1 text-xs font-semibold text-muted-foreground transition hover:bg-white/70"
                          >
                            Open report
                          </a>
                        ) : (
                          <a
                            href={resumeHref(job)}
                            className="rounded-full border border-white/30 px-3 py-1 text-xs font-semibold text-muted-foreground transition hover:bg-white/70"
                          >
                            Resume
                          </a>
                        )}
                        <a
                          href={`/jobs/${job.id}`}
                          className="rounded-full border border-white/20 px-3 py-1 text-xs text-muted-foreground/70 hover:bg-white/70"
                        >
                          View
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground/70">
                      No jobs match the selected filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-white/20 bg-white/90 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-muted">Upcoming schedule</h2>
          <p className="text-xs text-muted-foreground/60">Next field visits</p>
          <ul className="mt-4 space-y-3">
            {upcoming.length === 0 ? (
              <li className="rounded-2xl border border-dashed border-white/30 p-4 text-sm text-muted-foreground/70">
                No scheduled jobs yet.
              </li>
            ) : (
              upcoming.map((job) => (
                <li key={job.id} className="rounded-2xl border border-white/20 bg-white/70 p-4">
                  <p className="text-sm font-semibold text-muted">{job.title ?? job.client_name}</p>
                  <p className="text-xs text-muted-foreground/70">
                    {job.scheduled_for ? new Date(job.scheduled_for).toLocaleString() : 'Not scheduled'}
                  </p>
                  <p className="text-xs text-muted-foreground/60">{job.client_name}</p>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}

function resumeHref(job: JobRow) {
  switch (job.status) {
    case 'draft':
      return `/jobs/new/${job.id}/template`;
    case 'awaiting_signatures':
      return `/jobs/new/${job.id}/summary`;
    case 'awaiting_report':
      return `/jobs/new/${job.id}/ai`;
    case 'completed':
      return `/reports/${job.id}`;
    default:
      return `/jobs/${job.id}`;
  }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: 'bg-muted/40 text-muted-foreground',
    active: 'bg-[var(--accent)]/10 text-[var(--accent)]',
    awaiting_signatures: 'bg-amber-100 text-amber-700',
    awaiting_report: 'bg-sky-100 text-sky-700',
    completed: 'bg-emerald-100 text-emerald-700',
  };
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${map[status] ?? 'bg-muted'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
