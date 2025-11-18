import type { Database } from '@/lib/database.types';
import { listJobs } from '@/server/jobs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import JobsTable from '@/components/jobs/jobs-table';

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
        <JobsTable jobs={filtered} />

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
