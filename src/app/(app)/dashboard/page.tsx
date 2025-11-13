import Link from 'next/link';
import { redirect } from 'next/navigation';

import { supabaseServer } from '@/lib/supabaseServer';
import { listJobs } from '@/server/jobs';
import { listVisibleTemplates } from '@/server/templates';
import type { TemplateModel } from '@/types/template';
import NewJobModal from '@/components/new-job-modal';
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
};

const DAY_IN_MS = 86_400_000;
const MONTHLY_TARGET = 24;
const PENDING_THRESHOLD_DAYS = 1;
const FOLLOW_UP_THRESHOLD_DAYS = 7;

export default async function DashboardPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [jobGroups, templates] = await Promise.all([listJobs(), listVisibleTemplates('plumbing')]);
  const activeJobs = jobGroups.active as BasicJob[];
  const completedJobs = jobGroups.completed as BasicJob[];
  const allJobs: BasicJob[] = [...activeJobs, ...completedJobs];

  const now = new Date();
  const jobsThisMonth = allJobs.filter((job) => isSameMonth(new Date(job.created_at), now)).length;
  const completedCount = completedJobs.length;
  const totalJobs = allJobs.length;
  const completionRate = totalJobs === 0 ? 0 : Math.round((completedCount / totalJobs) * 100);
  const pendingSignoffs = activeJobs.filter(
    (job) => ageInDays(job.created_at, now) >= PENDING_THRESHOLD_DAYS,
  ).length;
  const followUpsDue = activeJobs.filter((job) => ageInDays(job.created_at, now) >= FOLLOW_UP_THRESHOLD_DAYS).length;

  const stats: Array<{ label: string; value: number; helper: string; icon: IconName }> = [
    {
      label: 'Jobs this month',
      value: jobsThisMonth,
      helper:
        jobsThisMonth >= MONTHLY_TARGET
          ? 'Monthly goal met'
          : `${MONTHLY_TARGET - jobsThisMonth} jobs to go`,
      icon: 'jobs',
    },
    {
      label: 'Reports generated',
      value: completedCount,
      helper: totalJobs ? `${completionRate}% completion rate` : 'Create your first job to begin',
      icon: 'reports',
    },
    {
      label: 'Clients awaiting sign-off',
      value: pendingSignoffs,
      helper: pendingSignoffs ? `${pendingSignoffs} signatures outstanding` : 'All signatures captured',
      icon: 'clients',
    },
  ];

  const recentJobs = [...allJobs]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 pb-16 pt-6 font-sans text-gray-900 md:pt-10">
      <section className="rounded-2xl border border-white/10 bg-[var(--surface)]/90 p-6 shadow-md backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Overview</p>
            <h1 className="mt-2 text-2xl font-semibold text-[var(--brand)]">Welcome back, {user.email}</h1>
            <p className="text-sm text-gray-500">
              Track field activity, client signatures, and compliance reports in one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" asChild className="rounded-full border border-[var(--muted)] px-5 py-2">
              <Link href="/clients">View clients</Link>
            </Button>
            <Button asChild className="rounded-full bg-[var(--accent)] px-5 py-2 text-white hover:bg-[var(--brand)]">
              <Link href="/jobs">New job</Link>
            </Button>
          </div>
        </div>
        <div className="mt-6">
          <KpiCards stats={stats} />
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
                description="Create a job to generate your first field checklist and capture compliance evidence."
                cta={
                  <Button asChild>
                    <Link href="/jobs">Create job</Link>
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
              value={pendingSignoffs}
              description="Send a link to clients awaiting signature."
              href="/jobs"
            />
            <MilestoneItem
              title="Follow-up visits"
              value={followUpsDue}
              description="Schedule technicians for unresolved findings."
              href="/reports"
            />
            <MilestoneItem
              title="Templates to review"
              value={templates.length}
              description="Keep your inspection templates up to date."
              href="/templates"
            />
          </CardContent>
        </Card>
      </section>

      <NewJobModal templates={templates as TemplateModel[]} />
    </div>
  );
}

function isSameMonth(date: Date, reference: Date) {
  return date.getMonth() === reference.getMonth() && date.getFullYear() === reference.getFullYear();
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

function getStatusMeta(job: BasicJob, reference: Date) {
  if (job.status === 'completed') {
    return { label: 'PASS', variant: 'brand' as const, className: '' };
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
