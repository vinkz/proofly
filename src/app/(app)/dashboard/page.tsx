import Link from 'next/link';
import { redirect } from 'next/navigation';

import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { getProfile } from '@/server/profile';
import { listJobs } from '@/server/jobs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { JobsListSection } from '@/app/(app)/jobs/JobsListSection';

type BasicJob = {
  id: string;
  client_name: string;
  address: string;
  status: string;
  created_at: string;
  title?: string | null;
  scheduled_for?: string | null;
};

const DAY_IN_MS = 86_400_000;
const FOLLOW_UP_THRESHOLD_DAYS = 7;

export default async function DashboardPage() {
  const supabase = await supabaseServerReadOnly();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [{ profile }, jobGroups] = await Promise.all([getProfile(), listJobs()]);
  const activeJobs = jobGroups.active as BasicJob[];
  const completedJobs = jobGroups.completed as BasicJob[];
  const allJobs: BasicJob[] = [...activeJobs, ...completedJobs];

  const now = new Date();
  const awaitingSignatures = allJobs.filter((job) => job.status === 'awaiting_signatures').length;
  const followUpsDue = activeJobs.filter((job) => ageInDays(job.created_at, now) >= FOLLOW_UP_THRESHOLD_DAYS).length;

  const currentJob =
    activeJobs.length > 0
      ? [...activeJobs].sort((a, b) => {
          const aDate = a.scheduled_for ? new Date(a.scheduled_for).getTime() : new Date(a.created_at).getTime();
          const bDate = b.scheduled_for ? new Date(b.scheduled_for).getTime() : new Date(b.created_at).getTime();
          return aDate - bDate;
        })[0]
      : null;

  const displayName =
    profile?.full_name && profile.full_name.trim().length
      ? profile.full_name.trim().split(/\s+/)[0]
      : user.email;

  const invoiceTotalsByMonth = await loadInvoiceTotalsByMonth(supabase, user.id);
  const upcomingJobs = activeJobs
    .filter((job) => job.scheduled_for && isWithinDays(job.scheduled_for, now, 30))
    .sort((a, b) => new Date(a.scheduled_for ?? '').getTime() - new Date(b.scheduled_for ?? '').getTime())
    .slice(0, 5);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 pb-16 pt-6 font-sans text-gray-900 md:pt-10">
      <section className="rounded-2xl border border-white/10 bg-[var(--surface)]/90 p-6 shadow-md backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Overview</p>
            <h1 className="mt-2 text-2xl font-semibold text-[var(--brand)]">Welcome back, {displayName}</h1>
            <p className="text-sm text-gray-600">Track field activity, client signatures, and certificates in one place.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" asChild className="rounded-full">
              <Link href="/invoices/new">Create invoice</Link>
            </Button>
            <Button variant="secondary" asChild className="rounded-full">
              <Link href="/jobs/new">+ New Job</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        {currentJob ? <CurrentJobTile job={currentJob} /> : <EmptyCurrentJobTile />}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="border border-white/10">
          <CardHeader>
            <CardTitle className="text-lg text-muted">Invoice totals</CardTitle>
            <CardDescription className="text-sm text-muted-foreground/70">
              Last 6 months, all statuses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3">
              {invoiceTotalsByMonth.map((item) => (
                <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
                  <div className="w-full rounded-full bg-[var(--muted)]/70 p-1">
                    <div
                      className="w-full rounded-full bg-[var(--accent)]"
                      style={{ height: `${item.height}px` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground/70">{item.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-between text-xs text-muted-foreground/70">
              <span>£{invoiceTotalsByMonth[0]?.total.toFixed(0) ?? '0'}</span>
              <span>£{invoiceTotalsByMonth[invoiceTotalsByMonth.length - 1]?.total.toFixed(0) ?? '0'}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-white/10">
          <CardHeader>
            <CardTitle className="text-lg text-muted">Upcoming jobs</CardTitle>
            <CardDescription className="text-sm text-muted-foreground/70">
              Next 30 days.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingJobs.length ? (
              upcomingJobs.map((job) => (
                <div key={job.id} className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-muted">
                      {job.title ?? job.client_name ?? 'Job'}
                    </p>
                    <p className="text-xs text-muted-foreground/70">{job.address}</p>
                  </div>
                  <span className="rounded-full bg-[var(--muted)] px-3 py-1 text-xs text-muted-foreground/70">
                    {formatDate(job.scheduled_for ?? '')}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground/70">No scheduled jobs in the next 30 days.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-muted">Jobs</h2>
          <p className="text-sm text-muted-foreground/70">
            Search, filter, and jump into any job in your pipeline.
          </p>
        </div>
        <JobsListSection jobs={[...activeJobs, ...completedJobs] as Array<Record<string, unknown>>} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card className="border border-white/10">
          <CardHeader>
            <CardTitle className="text-lg text-muted">Upcoming milestones</CardTitle>
            <CardDescription className="text-sm text-muted-foreground/70">
              Key signals that may need your attention this week.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <MilestoneItem
              title="Sign-off reminders"
              value={awaitingSignatures}
              description="Send a link to clients awaiting signature."
              href="/jobs"
            />
            <MilestoneItem
              title="Follow-up visits"
              value={followUpsDue}
              description="Schedule technicians for unresolved findings."
              href="/reports"
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function CurrentJobTile({ job }: { job: BasicJob }) {
  const schedule = job.scheduled_for
    ? `Scheduled ${formatDateTime(job.scheduled_for)}`
    : `Opened ${formatDate(job.created_at)}`;
  return (
    <div className="rounded-xl border border-white/10 bg-[var(--surface)]/95 p-5 shadow-md backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-[var(--accent)]">Current job</p>
          <p className="text-lg font-semibold text-muted">{job.title || job.client_name || 'Active job'}</p>
          <p className="text-sm text-muted-foreground/80">{job.address}</p>
          <p className="text-xs text-muted-foreground/70">{schedule}</p>
          <p className="text-[11px] font-semibold uppercase text-muted-foreground/70">
            Stage: {friendlyStage(job.status)}
          </p>
        </div>
        <Badge variant="brand" className="uppercase">
          {job.status}
        </Badge>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground/80">Open to continue certificate</span>
        <Link
          href={`/jobs/${job.id}`}
          className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-[var(--brand)] transition hover:bg-white/10"
        >
          Open job
        </Link>
      </div>
    </div>
  );
}

function EmptyCurrentJobTile() {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-dashed border-white/20 bg-white/40 p-5 text-sm shadow-inner backdrop-blur">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-gray-500">Current job</p>
        <p className="text-lg font-semibold text-muted">No active job</p>
        <p className="text-sm text-muted-foreground/70">Start a job to track live status here.</p>
      </div>
      <Button asChild className="mt-4 w-fit rounded-full bg-[var(--accent)] px-4 py-2 text-white">
        <Link href="/jobs/new/client">Create job</Link>
      </Button>
    </div>
  );
}

function ageInDays(dateString: string, reference: Date) {
  return Math.floor((reference.getTime() - new Date(dateString).getTime()) / DAY_IN_MS);
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(dateString: string) {
  return new Date(dateString).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  });
}

function isWithinDays(dateString: string | null | undefined, reference: Date, days: number) {
  if (!dateString) return false;
  const target = new Date(dateString).getTime();
  if (Number.isNaN(target)) return false;
  const diff = target - reference.getTime();
  return diff >= 0 && diff <= days * DAY_IN_MS;
}

async function loadInvoiceTotalsByMonth(
  supabase: Awaited<ReturnType<typeof supabaseServerReadOnly>>,
  userId: string,
) {
  try {
    type UntypedQuery = {
      select: (columns?: string) => UntypedQuery;
      eq: (column: string, value: unknown) => UntypedQuery;
      in: (column: string, values: unknown[]) => UntypedQuery;
    };
    type UntypedSupabase = { from: (table: string) => UntypedQuery };
    const untyped = supabase as unknown as UntypedSupabase;

    const { data: invoices, error: invoiceErr } = await (untyped
      .from('invoices')
      .select('id, issue_date, created_at, vat_rate')
      .eq('user_id', userId) as unknown as Promise<{ data: unknown; error: { message: string } | null }>);
    if (invoiceErr) return buildEmptyInvoiceSeries();

    const invoiceRows = (invoices ?? []) as Array<{
      id: string;
      issue_date: string | null;
      created_at: string | null;
      vat_rate: number | string | null;
    }>;
    const ids = invoiceRows.map((row) => row.id);
    const { data: items, error: itemsErr } = ids.length
      ? await (untyped
          .from('invoice_line_items')
          .select('invoice_id, quantity, unit_price, vat_exempt')
          .in('invoice_id', ids) as unknown as Promise<{ data: unknown; error: { message: string } | null }>)
      : { data: [] as Array<Record<string, unknown>>, error: null };
    if (itemsErr) return buildEmptyInvoiceSeries();

    const totalsByInvoice = new Map<string, number>();
    const lineRows = (items ?? []) as Array<{ invoice_id: string; quantity: number; unit_price: number; vat_exempt: boolean }>;
    invoiceRows.forEach((invoice) => {
      const rows = lineRows.filter((row) => row.invoice_id === invoice.id);
      const subtotal = rows.reduce((sum, row) => sum + Number(row.quantity ?? 0) * Number(row.unit_price ?? 0), 0);
      const taxable = rows.reduce(
        (sum, row) => sum + (row.vat_exempt ? 0 : Number(row.quantity ?? 0) * Number(row.unit_price ?? 0)),
        0,
      );
      const vatRate = Number(invoice.vat_rate ?? 0);
      totalsByInvoice.set(invoice.id, subtotal + taxable * vatRate);
    });

    const now = new Date();
    const months = [...Array(6)].map((_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      return {
        key: `${date.getFullYear()}-${date.getMonth() + 1}`,
        label: date.toLocaleDateString(undefined, { month: 'short' }),
        total: 0,
      };
    });

    invoiceRows.forEach((invoice) => {
      const dateValue = invoice.issue_date ?? invoice.created_at;
      if (!dateValue) return;
      const date = new Date(dateValue);
      if (Number.isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      const entry = months.find((item) => item.key === key);
      if (entry) {
        entry.total += totalsByInvoice.get(invoice.id) ?? 0;
      }
    });

    const max = Math.max(...months.map((item) => item.total), 1);
    return months.map((item) => ({
      ...item,
      height: Math.max(8, Math.round((item.total / max) * 80)),
    }));
  } catch {
    return buildEmptyInvoiceSeries();
  }
}

function buildEmptyInvoiceSeries() {
  const now = new Date();
  return [...Array(6)].map((_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth() + 1}`,
      label: date.toLocaleDateString(undefined, { month: 'short' }),
      total: 0,
      height: 8,
    };
  });
}

function friendlyStage(status: string | null | undefined) {
  switch (status) {
    case 'draft':
      return 'Drafting';
    case 'active':
      return 'Inspection in progress';
    case 'awaiting_signatures':
      return 'Awaiting signatures';
    case 'awaiting_report':
      return 'Generating report';
    case 'completed':
      return 'Completed';
    default:
      return 'Pending';
  }
}

function MilestoneItem({
  title,
  value,
  description,
  href,
}: {
  title: string;
  value: number;
  description: string;
  href: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground/80">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-muted">{title}</p>
          <p className="text-xs text-muted-foreground/70">{description}</p>
        </div>
        <Badge variant="brand" className="px-2 py-1 text-xs">
          {value}
        </Badge>
      </div>
      <Link
        href={href}
        className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-accent transition hover:text-muted"
      >
        Manage
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M5 12h14" strokeLinecap="round" />
          <path d="m13 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </div>
  );
}
