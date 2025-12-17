import Link from 'next/link';
import { redirect } from 'next/navigation';

import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { getProfile } from '@/server/profile';
import { listJobs } from '@/server/jobs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { KpiCards, type IconName } from './_components/kpi-cards';

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
  const completedCount = completedJobs.length;
  const totalJobs = allJobs.length;
  const completionRate = totalJobs === 0 ? 0 : Math.round((completedCount / totalJobs) * 100);
  const awaitingSignatures = allJobs.filter((job) => job.status === 'awaiting_signatures').length;
  const followUpsDue = activeJobs.filter((job) => ageInDays(job.created_at, now) >= FOLLOW_UP_THRESHOLD_DAYS).length;

  const stats: Array<{ label: string; value: number; helper: string; icon: IconName }> = [
    {
      label: 'Reports generated',
      value: completedCount,
      helper: totalJobs ? `${completionRate}% completion rate` : 'Create your first job to begin',
      icon: 'reports',
    },
    {
      label: 'Clients awaiting sign-off',
      value: awaitingSignatures,
      helper: awaitingSignatures ? `${awaitingSignatures} signatures outstanding` : 'All signatures captured',
      icon: 'clients',
    },
  ];

  const recentJobs = [...allJobs]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6);

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

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 pb-16 pt-6 font-sans text-gray-900 md:pt-10">
      <section className="rounded-2xl border border-white/10 bg-[var(--surface)]/90 p-6 shadow-md backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Overview</p>
            <h1 className="mt-2 text-2xl font-semibold text-[var(--brand)]">
              Welcome back, {displayName}
            </h1>
            <p className="text-sm text-gray-500">
              Track field activity, client signatures, and certificates in one place.
            </p>
          </div>
        </div>
        <div className="mt-6 rounded-2xl border border-white/10 bg-[var(--surface)]/90 p-4 shadow-md backdrop-blur">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {currentJob ? <CurrentJobTile job={currentJob} /> : <EmptyCurrentJobTile />}
            <KpiCards stats={stats} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card className="border border-white/10">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg text-muted">Recent jobs</CardTitle>
              <CardDescription className="text-sm text-muted-foreground/70">
                Latest activity across active and completed inspections.
              </CardDescription>
            </div>
            <Button variant="secondary" asChild>
              <Link href="/jobs">View schedule</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentJobs.length === 0 ? (
              <EmptyState
                title="No jobs on record yet"
                description="Create a certificate to capture field evidence and send PDFs."
                cta={
                  <Button asChild>
                    <Link href="/jobs">Create certificate</Link>
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-muted-foreground/60">
                      <th className="px-3 py-2 font-medium">Client</th>
                      <th className="px-3 py-2 font-medium text-center">Status</th>
                      <th className="px-3 py-2 font-medium">Created</th>
                      <th className="px-3 py-2 font-medium text-right">Quick actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {recentJobs.map((job) => {
                      const statusMeta = getStatusMeta(job, now);
                      return (
                        <tr key={job.id} className="transition hover:bg-white/5">
                          <td className="px-3 py-3">
                            <div className="font-semibold text-muted">{job.client_name}</div>
                            <p className="text-xs text-muted-foreground/70">{job.address}</p>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <Badge variant={statusMeta.variant} className={statusMeta.className}>
                              {statusMeta.label}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 text-sm text-muted-foreground/80">
                            {formatDate(job.created_at)}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                href={`/jobs/${job.id}`}
                                className="rounded-2xl border border-white/15 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-white/10 hover:text-muted"
                              >
                                View
                              </Link>
                              {job.status === 'completed' ? (
                                <Link
                                  href={`/reports/${job.id}`}
                                  className="rounded-2xl border border-white/15 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-white/10 hover:text-muted"
                                >
                                  Report
                                </Link>
                              ) : (
                                <span className="rounded-2xl border border-white/10 px-3 py-1.5 text-xs font-medium text-muted-foreground/50">
                                  Report
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

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
          <p className="text-sm text-muted-foreground/70">{job.address}</p>
          <p className="text-xs text-muted-foreground/60">{schedule}</p>
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

function getStatusMeta(job: BasicJob, reference: Date) {
  if (job.status === 'completed') {
    return { label: 'PASS', variant: 'brand' as const, className: '' };
  }
  if (job.status === 'awaiting_signatures') {
    return { label: 'SIGN', variant: 'outline' as const, className: 'border-amber-400 text-amber-500' };
  }
  if (job.status === 'awaiting_report') {
    return { label: 'AI', variant: 'outline' as const, className: 'border-sky-400 text-sky-500' };
  }
  if (ageInDays(job.created_at, reference) >= FOLLOW_UP_THRESHOLD_DAYS) {
    return {
      label: 'FAIL',
      variant: 'outline' as const,
      className: 'border-accent text-accent',
    };
  }
  return { label: 'PENDING', variant: 'muted' as const, className: '' };
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
