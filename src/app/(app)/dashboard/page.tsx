import Link from 'next/link';
import { redirect } from 'next/navigation';

import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { getProfile } from '@/server/profile';
import { listJobs } from '@/server/jobs';
import { buildCertificateResumeHref, getResumeStepFromRecord } from '@/lib/certificate-resume';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type BasicJob = {
  id: string;
  client_name: string;
  address: string;
  status: string;
  created_at: string;
  job_type?: string | null;
  title?: string | null;
  scheduled_for?: string | null;
};
type UpcomingJob = BasicJob & { prepComplete: boolean };

type UpcomingJobGroup = { label: string; jobs: UpcomingJob[] };
type JobRecordSummary = {
  job_id: string;
  updated_at: string;
  record: Record<string, unknown> | null;
};

const DAY_IN_MS = 86_400_000;
const FOLLOW_UP_THRESHOLD_DAYS = 7;
const PREP_REQUIRED_FIELD_KEYS = [
  'job_address_name',
  'job_address_line1',
  'job_postcode',
  'job_tel',
  'landlord_name',
  'landlord_address_line1',
  'landlord_city',
  'landlord_postcode',
] as const;

export default async function DashboardPage() {
  const supabase = await supabaseServerReadOnly();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [{ profile }, jobGroups] = await Promise.all([getProfile(), listJobs()]);
  const activeJobs = jobGroups.active as BasicJob[];

  const now = new Date();
  const awaitingSignatures = activeJobs.filter((job) => job.status === 'awaiting_signatures').length;
  const followUpsDue = activeJobs.filter((job) => ageInDays(job.created_at, now) >= FOLLOW_UP_THRESHOLD_DAYS).length;

  const activeJobIds = activeJobs.map((job) => job.id);
  let jobRecordRows: JobRecordSummary[] = [];
  if (activeJobIds.length) {
    try {
      const { data, error } = await supabase
        .from('job_records')
        .select('job_id, updated_at, record')
        .in('job_id', activeJobIds);
      if (error) throw error;
      jobRecordRows = (data ?? []) as JobRecordSummary[];
    } catch {
    }
  }
  const jobRecordByJobId = new Map(
    jobRecordRows.map((row) => [row.job_id, row]),
  );

  const currentJob =
    activeJobs.length > 0
      ? [...activeJobs]
          .map((job) => {
            const jobRecord = jobRecordByJobId.get(job.id) ?? null;
            const resumeStep = getResumeStepFromRecord(jobRecord?.record ?? null);
            return { job, jobRecord, resumeStep };
          })
          .filter((entry) => entry.resumeStep !== null)
          .sort((a, b) => new Date(b.jobRecord?.updated_at ?? b.job.created_at).getTime() - new Date(a.jobRecord?.updated_at ?? a.job.created_at).getTime())[0] ?? null
      : null;

  const displayName =
    profile?.full_name && profile.full_name.trim().length
      ? profile.full_name.trim().split(/\s+/)[0]
      : user.email;

  const upcomingJobsBase = activeJobs
    .filter((job) => job.scheduled_for && isTodayOrFuture(job.scheduled_for, now))
    .sort((a, b) => new Date(a.scheduled_for ?? '').getTime() - new Date(b.scheduled_for ?? '').getTime());
  const upcomingJobIds = upcomingJobsBase.map((job) => job.id);
  const { data: prepFieldRows, error: prepFieldErr } = upcomingJobIds.length
    ? await supabase
        .from('job_fields')
        .select('job_id, field_key, value')
        .in('job_id', upcomingJobIds)
        .in('field_key', [...PREP_REQUIRED_FIELD_KEYS])
    : { data: [], error: null };
  if (prepFieldErr) throw new Error(prepFieldErr.message);

  const prepFieldsByJob = (prepFieldRows ?? []).reduce<Record<string, Set<string>>>((acc, row) => {
    const jobId = row.job_id ?? '';
    const fieldKey = row.field_key ?? '';
    if (!jobId || !fieldKey || !row.value?.trim()) return acc;
    const current = acc[jobId] ?? new Set<string>();
    current.add(fieldKey);
    acc[jobId] = current;
    return acc;
  }, {});

  const upcomingJobs: UpcomingJob[] = upcomingJobsBase.map((job) => {
    const savedFields = prepFieldsByJob[job.id] ?? new Set<string>();
    return {
      ...job,
      prepComplete: PREP_REQUIRED_FIELD_KEYS.every((field) => savedFields.has(field)),
    };
  });
  const upcomingJobGroups: UpcomingJobGroup[] = [
    { label: 'Today', jobs: upcomingJobs.filter((job) => isSameDay(job.scheduled_for ?? '', now)) },
    { label: 'Tomorrow', jobs: upcomingJobs.filter((job) => isTomorrow(job.scheduled_for ?? '', now)) },
    { label: 'This week', jobs: upcomingJobs.filter((job) => isLaterThisWeek(job.scheduled_for ?? '', now)) },
    { label: 'Later', jobs: upcomingJobs.filter((job) => isAfterThisWeek(job.scheduled_for ?? '', now)) },
  ].filter((group) => group.jobs.length > 0);

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
        {currentJob ? (
          <CurrentJobTile
            job={currentJob.job}
            href={buildCertificateResumeHref({
              jobId: currentJob.job.id,
              jobType: currentJob.job.job_type,
              startStep: currentJob.resumeStep,
            })}
          />
        ) : (
          <EmptyCurrentJobTile />
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="border border-white/10">
          <CardHeader>
            <CardTitle className="text-lg text-muted">Upcoming jobs</CardTitle>
            <CardDescription className="text-sm text-muted-foreground/70">
              Scheduled today or later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingJobGroups.length ? (
              upcomingJobGroups.map((group) => (
                <div key={group.label} className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">{group.label}</p>
                  {group.jobs.map((job) => (
                    <div key={job.id} className="rounded-2xl border border-white/10 bg-white/40 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-muted">{job.client_name ?? job.title ?? 'Job'}</p>
                          <p className="text-xs text-muted-foreground/70">{job.address}</p>
                          <p className="mt-1 text-xs text-muted-foreground/70">
                            {formatDateTime(job.scheduled_for ?? '')}
                          </p>
                          {job.job_type === 'safety_check' ? (
                            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
                              {job.prepComplete ? 'Ready to start' : 'Step 1 incomplete'}
                            </p>
                          ) : null}
                        </div>
                        <Badge variant="brand" className="uppercase">
                          {job.status ?? 'draft'}
                        </Badge>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Button asChild variant="secondary" className="rounded-full">
                          <Link href={getUpcomingJobHref(job)}>
                            {getUpcomingJobActionLabel(job)}
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground/70">No upcoming scheduled jobs.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border border-white/10">
          <CardHeader>
            <CardTitle className="text-lg text-muted">Find jobs fast</CardTitle>
            <CardDescription className="text-sm text-muted-foreground/70">
              Search upcoming flows and past PDFs from one list.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/40 p-4">
              <p className="text-sm font-semibold text-muted">Jobs is now the main archive</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Use the searchable jobs list to find upcoming work, reopen in-progress flows, or open past certificate PDFs.
              </p>
            </div>
            <Button asChild variant="secondary" className="rounded-full">
              <Link href="/jobs">Open jobs list</Link>
            </Button>
          </CardContent>
        </Card>
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
              href="/documents"
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function CurrentJobTile({ job, href }: { job: BasicJob; href: string }) {
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
          href={href}
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
  if (!dateString) return 'Unknown';
  return new Date(dateString).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  });
}

function isTodayOrFuture(dateString: string | null | undefined, reference: Date) {
  if (!dateString) return false;
  const target = new Date(dateString).getTime();
  if (Number.isNaN(target)) return false;
  const todayStart = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate()).getTime();
  return target >= todayStart;
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function isSameDay(dateString: string | null | undefined, reference: Date) {
  if (!dateString) return false;
  const target = new Date(dateString);
  if (Number.isNaN(target.getTime())) return false;
  return startOfDay(target).getTime() === startOfDay(reference).getTime();
}

function isTomorrow(dateString: string | null | undefined, reference: Date) {
  if (!dateString) return false;
  const target = new Date(dateString);
  if (Number.isNaN(target.getTime())) return false;
  const tomorrow = startOfDay(reference);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return startOfDay(target).getTime() === tomorrow.getTime();
}

function isLaterThisWeek(dateString: string | null | undefined, reference: Date) {
  if (!dateString) return false;
  const target = new Date(dateString);
  if (Number.isNaN(target.getTime())) return false;
  const targetDay = startOfDay(target).getTime();
  const tomorrow = startOfDay(reference);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekEnd = startOfDay(reference);
  weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));
  return targetDay > tomorrow.getTime() && targetDay < weekEnd.getTime();
}

function isAfterThisWeek(dateString: string | null | undefined, reference: Date) {
  if (!dateString) return false;
  const target = new Date(dateString);
  if (Number.isNaN(target.getTime())) return false;
  const weekEnd = startOfDay(reference);
  weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));
  return startOfDay(target).getTime() >= weekEnd.getTime();
}

function getUpcomingJobHref(job: UpcomingJob) {
  if (job.job_type === 'safety_check') {
    return `/wizard/create/cp12?jobId=${job.id}`;
  }
  return `/jobs/${job.id}`;
}

function getUpcomingJobActionLabel(job: UpcomingJob) {
  if (job.job_type === 'safety_check') {
    return 'Start';
  }
  return 'Open';
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
