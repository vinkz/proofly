import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getSupabaseUser, supabaseServerReadOnly } from '@/lib/supabaseServer';
import { getProfile } from '@/server/profile';
import { listJobs } from '@/server/jobs';
import { dismissJobRequest, listPendingJobRequestsForDashboard, type DashboardJobRequest } from '@/server/job-requests';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AwaitingSignaturesCard, type AwaitingSignatureJobCard } from './_components/awaiting-signatures-card';
import { JOB_TYPE_LABELS, type JobType } from '@/types/job-records';

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

const DASHBOARD_JOB_TYPE_LABELS: Partial<Record<JobType, string>> = {
  safety_check: 'CP12',
  service: 'Boiler Service',
  installation: 'Commissioning',
  warning_notice: 'Gas Warning Notice',
  general: 'General Works',
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const supabase = await supabaseServerReadOnly();
  const user = await getSupabaseUser(supabase);

  if (!user) redirect('/login');

  const [{ profile }, jobGroups, jobRequests] = await Promise.all([
    getProfile(),
    listJobs(),
    listPendingJobRequestsForDashboard(),
  ]);
  const activeJobs = jobGroups.active as BasicJob[];
  const completedJobs = jobGroups.completed as BasicJob[];

  const now = new Date();
  const awaitingSignatures = activeJobs.filter((job) => job.status === 'awaiting_signatures').length;
  const followUpsDue = activeJobs.filter((job) => ageInDays(job.created_at, now) >= FOLLOW_UP_THRESHOLD_DAYS).length;

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
  const nextUpcomingJob = upcomingJobs[0] ?? null;
  const awaitingSignatureJobsBase = activeJobs.filter((job) => job.status === 'awaiting_signatures');
  const awaitingSignatureJobIds = awaitingSignatureJobsBase.map((job) => job.id);
  const { data: awaitingFieldRows, error: awaitingFieldErr } = awaitingSignatureJobIds.length
    ? await supabase
        .from('job_fields')
        .select('job_id, field_key, value')
        .in('job_id', awaitingSignatureJobIds)
        .in('field_key', ['cp12_remote_signature_token', 'cp12_remote_signature_expires_at'])
    : { data: [], error: null };
  if (awaitingFieldErr) throw new Error(awaitingFieldErr.message);

  const awaitingFieldMap = (awaitingFieldRows ?? []).reduce<Record<string, Record<string, string>>>((acc, row) => {
    const jobId = row.job_id ?? '';
    const fieldKey = row.field_key ?? '';
    const value = row.value ?? '';
    if (!jobId || !fieldKey || !value) return acc;
    acc[jobId] = { ...(acc[jobId] ?? {}), [fieldKey]: value };
    return acc;
  }, {});

  const awaitingSignatureJobs: AwaitingSignatureJobCard[] = awaitingSignatureJobsBase
    .map((job) => {
      const fields = awaitingFieldMap[job.id] ?? {};
      const token = fields.cp12_remote_signature_token ?? null;
      return {
        ...job,
        shareLink: token ? `/sign/cp12/${token}` : null,
        expiresAt: fields.cp12_remote_signature_expires_at ?? null,
      };
    })
    .filter((job) => job.shareLink)
    .sort((a, b) => {
      const left = new Date(a.scheduled_for ?? a.created_at ?? '').getTime();
      const right = new Date(b.scheduled_for ?? b.created_at ?? '').getTime();
      return left - right;
    });
  const calendarJobs = [...upcomingJobs, ...completedJobs].filter((job) => getJobCalendarDate(job));
  const selectedDate = normalizeDateOnly(
    resolvedSearchParams?.date ?? getJobCalendarDate(nextUpcomingJob) ?? new Date().toISOString().slice(0, 10),
  );
  const calendarMonth = buildCalendarMonth(selectedDate, calendarJobs);
  const selectedDayJobs = calendarJobs
    .filter((job) => getJobCalendarDate(job) === selectedDate)
    .sort((a, b) => {
      const left = new Date(a.scheduled_for ?? a.created_at ?? '').getTime();
      const right = new Date(b.scheduled_for ?? b.created_at ?? '').getTime();
      return left - right;
    });
  const monthCompletedJobs = calendarMonth.monthJobs.filter((job) => isCompletedJob(job)).length;
  const monthProgress = calendarMonth.monthJobs.length
    ? Math.round((monthCompletedJobs / calendarMonth.monthJobs.length) * 100)
    : 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 pb-16 pt-6 font-sans text-gray-900 md:pt-10">
      <section className="rounded-2xl border border-white/10 bg-[var(--surface)]/90 p-6 shadow-md backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--brand)]">Welcome back, {displayName}</h1>
            <p className="text-sm text-gray-600">Track field activity, client signatures, and certificates in one place.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" asChild className="rounded-full">
              <Link href="/jobs/new">+ New Job</Link>
            </Button>
            <Button variant="secondary" asChild className="rounded-full">
              <Link href="/invoices/new">Create invoice</Link>
            </Button>
          </div>
        </div>
      </section>

      {jobRequests.length ? (
        <section className="rounded-[2rem] border border-amber-200/70 bg-amber-50/80 p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700/80">Landlord requests</p>
              <h2 className="text-xl font-semibold text-amber-950">Requests needing review</h2>
            </div>
            <p className="text-sm text-amber-900/75">{jobRequests.length} pending</p>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {jobRequests.map((request) => (
              <JobRequestCard key={request.id} request={request} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#f8faf6] shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <div className="grid lg:grid-cols-[1.35fr,0.85fr]">
          <div className="p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground/70">Job calendar</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--brand)]">
                  {calendarMonth.label}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground/75">
                  Scheduled and completed work in one monthly view.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" asChild className="rounded-full text-xs">
                  <Link href={`/dashboard?date=${calendarMonth.previousMonthDate}`}>Previous</Link>
                </Button>
                <Button variant="secondary" asChild className="rounded-full text-xs">
                  <Link href={`/dashboard?date=${calendarMonth.nextMonthDate}`}>Next</Link>
                </Button>
                <Button variant="secondary" asChild className="rounded-full text-xs">
                  <Link href="/jobs">View all jobs</Link>
                </Button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <div key={day} className="py-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarMonth.days.map((day) => {
                const dayProgress = day.jobs.length
                  ? Math.round((day.jobs.filter((job) => isCompletedJob(job)).length / day.jobs.length) * 100)
                  : 0;
                return (
                  <Link
                    key={day.date}
                    href={`/dashboard?date=${day.date}`}
                    className={`group min-h-20 rounded-2xl border p-2 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-sm ${
                      day.date === selectedDate
                        ? 'border-[var(--action)] bg-white shadow-sm'
                        : day.isCurrentMonth
                          ? 'border-white/70 bg-white/55'
                          : 'border-transparent bg-white/25 text-muted-foreground/45'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{day.dayNumber}</span>
                      {day.jobs.length ? (
                        <span className="rounded-full bg-[var(--brand)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {day.jobs.length}
                        </span>
                      ) : null}
                    </div>
                    {day.jobs.length ? (
                      <div className="mt-3">
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-[var(--action)] transition-all duration-300"
                            style={{ width: `${dayProgress}%` }}
                          />
                        </div>
                        <p className="mt-1 text-[10px] font-medium text-muted-foreground/70">
                          {dayProgress}% complete
                        </p>
                      </div>
                    ) : (
                      <div className="mt-6 h-px bg-slate-200/70 opacity-0 transition group-hover:opacity-100" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          <aside className="border-t border-white/70 bg-white/70 p-4 sm:p-6 lg:border-l lg:border-t-0">
            <div className="grid grid-cols-3 gap-2">
              <CalendarStat label="Month jobs" value={calendarMonth.monthJobs.length} />
              <CalendarStat label="Complete" value={monthCompletedJobs} />
              <CalendarStat label="Progress" value={`${monthProgress}%`} />
            </div>

            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground/60">
                {formatSelectedDate(selectedDate)}
              </p>
              <h3 className="mt-1 text-xl font-semibold text-[var(--brand)]">
                {selectedDayJobs.length ? `${selectedDayJobs.length} job${selectedDayJobs.length === 1 ? '' : 's'}` : 'No jobs'}
              </h3>
            </div>

            <div className="mt-4 space-y-3">
              {selectedDayJobs.length ? (
                selectedDayJobs.map((job) => (
                  <DashboardJobRow key={job.id} job={job} />
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-4 text-sm text-muted-foreground/70">
                  Pick another day or create a new job for this date.
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>

      <section>
        <AwaitingSignaturesCard jobs={awaitingSignatureJobs} />
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
              href="/jobs"
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function ageInDays(dateString: string, reference: Date) {
  return Math.floor((reference.getTime() - new Date(dateString).getTime()) / DAY_IN_MS);
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

function normalizeDateOnly(value: string | null | undefined) {
  const dateOnly = String(value ?? '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return new Date().toISOString().slice(0, 10);
  }
  return dateOnly;
}

function getJobCalendarDate(job: BasicJob | null | undefined) {
  if (!job) return '';
  const date = job.scheduled_for ?? job.created_at ?? '';
  if (!date) return '';
  return normalizeDateOnly(date);
}

function buildCalendarMonth(selectedDate: string, jobs: BasicJob[]) {
  const selected = new Date(`${selectedDate}T00:00:00`);
  const year = selected.getFullYear();
  const month = selected.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - mondayOffset);
  const monthJobs = jobs.filter((job) => {
    const date = getJobCalendarDate(job);
    const parsed = new Date(`${date}T00:00:00`);
    return parsed.getFullYear() === year && parsed.getMonth() === month;
  });

  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const dateKey = date.toISOString().slice(0, 10);
    return {
      date: dateKey,
      dayNumber: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
      jobs: jobs.filter((job) => getJobCalendarDate(job) === dateKey),
    };
  });

  return {
    days,
    monthJobs,
    label: selected.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    previousMonthDate: new Date(year, month - 1, 1).toISOString().slice(0, 10),
    nextMonthDate: new Date(year, month + 1, 1).toISOString().slice(0, 10),
  };
}

function isCompletedJob(job: BasicJob) {
  return ['completed', 'issued', 'closed'].includes(String(job.status ?? '').toLowerCase());
}

function formatSelectedDate(dateString: string) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function getUpcomingJobHref(job: BasicJob & { prepComplete?: boolean }) {
  if (job.job_type === 'safety_check') {
    if (job.prepComplete === false) {
      return `/wizard/create/cp12?jobId=${job.id}&prepare=1`;
    }
    return `/wizard/create/cp12?jobId=${job.id}`;
  }
  if (job.job_type === 'service') {
    return `/wizard/create/boiler_service?jobId=${job.id}`;
  }
  if (job.job_type === 'warning_notice') {
    return `/wizard/create/gas_warning_notice?jobId=${job.id}`;
  }
  return `/jobs/${job.id}`;
}

function getUpcomingJobActionLabel(job: BasicJob & { prepComplete?: boolean }) {
  if (isCompletedJob(job)) {
    return 'Open PDF';
  }
  if (job.job_type === 'safety_check') {
    if (job.prepComplete === false) return 'Prepare';
    return 'Start';
  }
  return 'Open';
}

function getDashboardJobTypeLabel(jobType: string | null | undefined) {
  if (!jobType) return 'Job';
  if (jobType in DASHBOARD_JOB_TYPE_LABELS) {
    return DASHBOARD_JOB_TYPE_LABELS[jobType as JobType] ?? jobType;
  }
  if (jobType in JOB_TYPE_LABELS) {
    return JOB_TYPE_LABELS[jobType as JobType];
  }
  return jobType
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function CalendarStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-slate-950 px-3 py-3 text-white">
      <p className="text-lg font-semibold leading-none">{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">{label}</p>
    </div>
  );
}

function JobRequestCard({ request }: { request: DashboardJobRequest }) {
  const label = request.requestType === 'renewal' ? 'Renewal Request' : 'New Job Request';
  return (
    <div className="rounded-3xl bg-white/85 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-amber-950">{label}</p>
          <p className="mt-1 text-sm text-amber-900/80">{request.propertyAddress ?? 'Property address missing'}</p>
        </div>
        <Badge variant="brand" className="uppercase">
          {request.source === 'public_job_page' ? 'Public link' : 'New landlord'}
        </Badge>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
        <p>Landlord: {request.landlordName ?? request.landlordEmail ?? 'Not captured'}</p>
        <p>Phone: {request.landlordPhone ?? 'Not captured'}</p>
        <p>Tenant: {request.tenantName ?? 'Not provided'}</p>
        <p>Tenant phone: {request.tenantPhone ?? 'Not provided'}</p>
        <p className="sm:col-span-2">Access: {request.accessNotes ?? 'Not provided'}</p>
        <p className="sm:col-span-2">Preferred dates: {request.preferredDates ?? 'Not provided'}</p>
        {request.engineerName || request.engineerEmail || request.engineerPhone ? (
          <p className="sm:col-span-2">
            Engineer supplied: {[request.engineerName, request.engineerCompany, request.engineerEmail, request.engineerPhone, request.engineerGasSafeNumber ? `Gas Safe ${request.engineerGasSafeNumber}` : null]
              .filter(Boolean)
              .join(' / ')}
          </p>
        ) : null}
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button asChild className="rounded-full">
          <Link href={`/jobs/new?requestId=${request.id}`}>Schedule job</Link>
        </Button>
        <form
          action={async () => {
            'use server';
            await dismissJobRequest(request.id);
          }}
        >
          <Button type="submit" variant="outline" className="w-full rounded-full sm:w-auto">
            Dismiss
          </Button>
        </form>
      </div>
    </div>
  );
}

function DashboardJobRow({ job }: { job: BasicJob & { prepComplete?: boolean } }) {
  const completed = isCompletedJob(job);
  const href = completed ? `/jobs/${job.id}/pdf` : getUpcomingJobHref(job);
  const actionLabel = completed ? 'Open PDF' : getUpcomingJobActionLabel(job);
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--brand)]">{job.client_name ?? job.title ?? 'Job'}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground/75">
            {getDashboardJobTypeLabel(job.job_type)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">{job.address}</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            {formatDateTime(job.scheduled_for ?? job.created_at ?? '')}
          </p>
          {job.job_type === 'safety_check' && !completed ? (
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
              {job.prepComplete ? 'Ready to start' : 'Step 1 incomplete'}
            </p>
          ) : null}
        </div>
        <Badge variant="brand" className="uppercase">
          {completed ? 'Done' : job.status ?? 'draft'}
        </Badge>
      </div>
      <div className="mt-3 flex justify-end">
        <Button asChild variant={completed ? 'secondary' : 'primary'} className="rounded-full text-xs">
          <Link href={href}>{actionLabel}</Link>
        </Button>
      </div>
    </div>
  );
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
