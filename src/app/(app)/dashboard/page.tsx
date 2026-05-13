import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { getSupabaseUser, supabaseServerReadOnly } from '@/lib/supabaseServer';
import { getProfile } from '@/server/profile';
import {
  listJobs,
} from '@/server/jobs';
import {
  dismissJobRequest,
  getOrCreateEngineerRequestLink,
  listPendingJobRequestsForDashboard,
  type DashboardJobRequest,
} from '@/server/job-requests';
import { CopyRequestLinkButton } from './_components/copy-request-link-button';
import { JOB_TYPE_LABELS, type JobType } from '@/types/job-records';
import { formatDisplayAddress } from '@/lib/address';

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

  const [{ profile }, jobGroups, jobRequests, requestLink] = await Promise.all([
    getProfile(),
    listJobs(),
    listPendingJobRequestsForDashboard(),
    getOrCreateEngineerRequestLink(),
  ]);
  const activeJobs = jobGroups.active as BasicJob[];
  const completedJobs = jobGroups.completed as BasicJob[];

  const now = new Date();
  const awaitingSignatures = activeJobs.filter((job) => job.status === 'awaiting_signatures').length;
  const { count: followUpsDueCount, error: followUpsDueErr } = await (
    // certificate_type and parent_job_id are legacy migration columns not present in every generated type.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase as any
  )
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('certificate_type', 'gas_warning_notice')
    .not('parent_job_id', 'is', null)
    .in('status', ['draft', 'prepared']);
  if (followUpsDueErr && !['42703', 'PGRST204'].includes(followUpsDueErr.code ?? '')) {
    throw new Error(followUpsDueErr.message);
  }
  const followUpsDue = followUpsDueCount ?? 0;

  const displayName =
    profile?.full_name && profile.full_name.trim().length
      ? profile.full_name.trim().split(/\s+/)[0]
      : user.email;
  const personalRequestPath = requestLink.path;
  const latestRequest = jobRequests[0] ?? null;

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
  const todayKey = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 px-4 pb-12 pt-2">
      {/* Page header — slim greeting + primary CTA (full top nav is a future layout pass) */}
      <header className="flex items-center justify-between gap-3 pt-1">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">
            Welcome back
          </p>
          <h1 className="text-[18px] font-medium text-[var(--color-text-primary)]">{displayName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/jobs/new"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[20px] bg-[var(--color-cta)] px-4 text-[13px] font-medium text-[var(--color-cta-fg)] transition-colors hover:bg-[var(--color-text-primary)]"
          >
            <PlusIcon />
            New job
          </Link>
        </div>
      </header>

      {/* Inbound Requests */}
      <section className="space-y-2">
        <div className="flex items-center gap-2 px-0.5">
          <h2 className="text-[13px] font-medium text-[var(--color-text-primary)]">Inbound requests</h2>
          {jobRequests.length ? (
            <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[10px] bg-[var(--color-red-bg)] px-1.5 text-[11px] font-medium text-[var(--color-red)]">
              {jobRequests.length}
            </span>
          ) : null}
        </div>

        {latestRequest ? (
          <JobRequestCard request={latestRequest} />
        ) : (
          <NoRequestsEmpty url={requestLink.url} path={personalRequestPath} />
        )}
      </section>

      {/* Calendar */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-[15px] font-medium text-[var(--color-text-primary)]">{calendarMonth.label}</h2>
          <div className="flex items-center gap-1.5">
            <Link
              href={`/dashboard?date=${calendarMonth.previousMonthDate}`}
              aria-label="Previous month"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-background-tertiary)] hover:text-[var(--color-text-primary)]"
            >
              <ChevronLeftIcon />
            </Link>
            <Link
              href={`/dashboard?date=${calendarMonth.nextMonthDate}`}
              aria-label="Next month"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-background-tertiary)] hover:text-[var(--color-text-primary)]"
            >
              <ChevronRightIcon />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 px-0.5 text-center text-[11px] font-medium text-[var(--color-text-tertiary)]">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => (
            <div key={`${day}-${idx}`} className="py-1">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 px-0.5">
          {calendarMonth.days.map((day) => {
            const isSelected = day.date === selectedDate;
            const isToday = day.date === todayKey;
            const hasJobs = day.jobs.length > 0;
            const hasAmber = day.jobs.some((job) => needsPrep(job));
            const cellTone = isToday
              ? 'bg-[var(--color-cta)] text-[var(--color-cta-fg)]'
              : isSelected
                ? 'bg-[var(--color-action-bg)] text-[var(--color-action)]'
                : day.isCurrentMonth
                  ? hasJobs
                    ? 'bg-[var(--color-background-primary)] text-[var(--color-text-primary)]'
                    : 'bg-transparent text-[var(--color-text-secondary)]'
                  : 'bg-transparent text-[var(--color-text-tertiary)]';
            const dotColor = isToday
              ? 'bg-white'
              : hasAmber
                ? 'bg-[var(--color-amber)]'
                : 'bg-[var(--color-action)]';

            return (
              <Link
                key={day.date}
                href={`/dashboard?date=${day.date}`}
                className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-[8px] text-[13px] font-medium transition-colors ${cellTone}`}
              >
                <span className={hasJobs || isToday || isSelected ? 'font-medium' : 'font-normal'}>
                  {day.dayNumber}
                </span>
                {hasJobs ? (
                  <span className={`h-1 w-1 rounded-full ${dotColor}`} aria-hidden="true" />
                ) : (
                  <span className="h-1 w-1" aria-hidden="true" />
                )}
              </Link>
            );
          })}
        </div>
      </section>

      {/* Selected day jobs */}
      <section className="space-y-2">
        <p className="px-1 text-[10px] font-medium uppercase tracking-[1px] text-[var(--color-text-tertiary)]">
          {formatSelectedDate(selectedDate)}
        </p>

        {selectedDayJobs.length ? (
          <div className="space-y-2">
            {selectedDayJobs.map((job) => (
              <DashboardJobRow key={job.id} job={job} />
            ))}
          </div>
        ) : (
          <div className="rounded-[16px] border-[0.5px] border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-4 py-6 text-center">
            <p className="text-[14px] font-normal text-[var(--color-text-secondary)]">
              No jobs scheduled. Pick another day or create a new job.
            </p>
          </div>
        )}
      </section>

      {/* Stats row */}
      <section className="grid grid-cols-2 gap-2.5">
        <StatCard label="Issued this month" value={monthCompletedJobs} tone="action" />
        <StatCard label="Renewals due" value={followUpsDue} tone="amber" />
        <StatCard label="Awaiting signatures" value={awaitingSignatures} />
        <StatCard label="Total this month" value={calendarMonth.monthJobs.length} />
      </section>
    </div>
  );
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

function formatTimeShort(dateString: string) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatRelativeTime(dateString: string | null | undefined) {
  if (!dateString) return null;
  const target = new Date(dateString).getTime();
  if (Number.isNaN(target)) return null;
  const diffMs = Date.now() - target;
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
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
  return ['completed', 'closed', 'delivered'].includes(String(job.status ?? '').toLowerCase());
}

function isIssuedJob(job: BasicJob) {
  return String(job.status ?? '').toLowerCase() === 'issued';
}

function needsPrep(job: BasicJob & { prepComplete?: boolean }) {
  return job.job_type === 'safety_check' && job.prepComplete === false;
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
  if (isIssuedJob(job)) {
    return 'Review & send';
  }
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

function StatCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number | string;
  tone?: 'default' | 'action' | 'amber';
}) {
  const valueColor =
    tone === 'action'
      ? 'text-[var(--color-action)]'
      : tone === 'amber'
        ? 'text-[var(--color-amber)]'
        : 'text-[var(--color-text-primary)]';
  return (
    <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-4 py-3.5">
      <p className={`text-[26px] font-medium leading-none ${valueColor}`}>{value}</p>
      <p className="mt-2 text-[12px] font-normal text-[var(--color-text-secondary)]">{label}</p>
    </div>
  );
}

function JobRequestCard({ request }: { request: DashboardJobRequest }) {
  const isRenewal = request.requestType === 'renewal';
  const accentColor = isRenewal ? 'bg-[var(--color-red)]' : 'bg-[var(--color-action)]';
  const badgeClass = isRenewal
    ? 'bg-[var(--color-red-bg)] text-[var(--color-red)]'
    : 'bg-[var(--color-action-bg)] text-[var(--color-action)]';
  const badgeLabel = isRenewal ? 'Renewal' : 'New job';
  const relative = formatRelativeTime(request.createdAt);
  const address = formatDisplayAddress(request.propertyAddress) || 'Property address missing';
  const landlordLine = request.landlordName ?? request.landlordEmail ?? null;
  const tenantLine = request.tenantName ?? null;

  return (
    <article className="overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
      <div className={`h-[3px] w-full ${accentColor}`} aria-hidden="true" />
      <div className="px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium leading-tight text-[var(--color-text-primary)]">
              {address}
            </p>
            {relative ? (
              <p className="mt-0.5 text-[12px] font-normal text-[var(--color-text-tertiary)]">{relative}</p>
            ) : null}
          </div>
          <span
            className={`inline-flex items-center rounded-[10px] px-2 py-0.5 text-[11px] font-medium ${badgeClass}`}
          >
            {badgeLabel}
          </span>
        </div>

        <div className="mt-3 space-y-[5px]">
          {landlordLine ? (
            <DetailRow icon={<UserIcon />} text={landlordLine} />
          ) : null}
          {tenantLine ? (
            <DetailRow icon={<UsersIcon />} text={`Tenant · ${tenantLine}`} />
          ) : null}
          {request.preferredDates ? (
            <DetailRow icon={<CalendarIcon />} text={request.preferredDates} />
          ) : null}
          {isRenewal ? (
            <DetailRow
              icon={<AlertTriangleIcon />}
              text="Renewal flagged — verify expiry"
              tone="danger"
            />
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t-[0.5px] border-[var(--color-border-tertiary)] px-4 pb-3 pt-2.5">
        <Link
          href={`/jobs/new?requestId=${request.id}`}
          className="inline-flex h-9 flex-[2] items-center justify-center rounded-[18px] bg-[var(--color-cta)] text-[13px] font-medium text-[var(--color-cta-fg)] transition-colors hover:bg-[var(--color-text-primary)]"
        >
          Schedule job
        </Link>
        <form
          action={async () => {
            'use server';
            await dismissJobRequest(request.id);
          }}
        >
          <button
            type="submit"
            className="inline-flex h-9 items-center justify-center rounded-[18px] bg-[var(--color-red-bg)] px-3.5 text-[13px] font-medium text-[var(--color-red)] transition-opacity hover:opacity-90"
          >
            Dismiss
          </button>
        </form>
      </div>
    </article>
  );
}

function NoRequestsEmpty({ url, path }: { url: string; path: string }) {
  return (
    <div className="rounded-[16px] border-[0.5px] border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-5 py-8 text-center">
      <div className="mx-auto mb-3 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[var(--color-action-bg)] text-[var(--color-action)]">
        <LinkIcon />
      </div>
      <h3 className="text-[16px] font-medium text-[var(--color-text-primary)]">No requests yet</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-[14px] font-normal leading-[1.6] text-[var(--color-text-secondary)]">
        Share your link and landlords can send you job details directly — no back-and-forth needed.
      </p>
      <div className="mt-4 truncate rounded-[8px] bg-[var(--color-background-tertiary)] px-3 py-2 text-[12px] font-normal text-[var(--color-text-secondary)]">
        {url}
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <Link
          href={path}
          className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-[22px] bg-[var(--color-cta)] text-[15px] font-medium text-[var(--color-cta-fg)] transition-colors hover:bg-[var(--color-text-primary)]"
        >
          <LinkIcon /> Open link
        </Link>
        <CopyRequestLinkButton url={url} />
        <Link
          href="/requests"
          className="inline-flex h-11 w-full items-center justify-center rounded-[22px] border-[0.5px] border-[var(--color-border-secondary)] bg-transparent text-[15px] font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-background-tertiary)]"
        >
          View all requests
        </Link>
      </div>
    </div>
  );
}

function DashboardJobRow({ job }: { job: BasicJob & { prepComplete?: boolean } }) {
  const issued = isIssuedJob(job);
  const completed = isCompletedJob(job);
  const href = issued ? `/jobs/${job.id}/complete` : completed ? `/jobs/${job.id}/pdf` : getUpcomingJobHref(job);
  const actionLabel = issued ? 'Review & send' : completed ? 'Open PDF' : getUpcomingJobActionLabel(job);

  const accent = needsPrep(job)
    ? 'bg-[var(--color-amber)]'
    : completed
      ? 'bg-[var(--color-blue)]'
      : 'bg-[var(--color-action)]';

  let ctaClass: string;
  if (actionLabel === 'Prepare' || actionLabel === 'Open') {
    ctaClass =
      'border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)]';
  } else if (actionLabel === 'Review & send' || actionLabel === 'Open PDF') {
    ctaClass = 'bg-[var(--color-action-bg)] text-[var(--color-action)]';
  } else {
    ctaClass = 'bg-[var(--color-cta)] text-[var(--color-cta-fg)]';
  }

  const timeLabel = job.scheduled_for ? formatTimeShort(job.scheduled_for) : '';

  return (
    <article className="overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
      <div className={`h-[3px] w-full ${accent}`} aria-hidden="true" />
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-[44px] text-right text-[12px] font-normal text-[var(--color-text-tertiary)]">
          {timeLabel || '—'}
        </div>
        <div className="h-9 w-px bg-[var(--color-border-tertiary)]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">
            {getDashboardJobTypeLabel(job.job_type)}
          </p>
          <p className="mt-0.5 truncate text-[15px] font-medium text-[var(--color-text-primary)]">
            {job.client_name ?? job.title ?? 'Job'}
          </p>
          <p className="truncate text-[13px] font-normal text-[var(--color-text-secondary)]">{job.address}</p>
        </div>
        <Link
          href={href}
          className={`inline-flex h-8 shrink-0 items-center justify-center rounded-[16px] px-3 text-[13px] font-medium transition-colors ${ctaClass}`}
        >
          {actionLabel}
        </Link>
      </div>
    </article>
  );
}

function DetailRow({
  icon,
  text,
  tone = 'default',
}: {
  icon: ReactNode;
  text: string;
  tone?: 'default' | 'danger';
}) {
  const color = tone === 'danger' ? 'text-[var(--color-red)]' : 'text-[var(--color-text-secondary)]';
  return (
    <div className={`flex items-center gap-[7px] text-[13px] font-normal ${color}`}>
      <span className="flex h-[14px] w-[14px] shrink-0 items-center justify-center">{icon}</span>
      <span className="truncate">{text}</span>
    </div>
  );
}

/* ---------- Icons (inline SVG, currentColor) ---------- */

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function AlertTriangleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

