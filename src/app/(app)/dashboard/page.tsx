import Link from 'next/link';
import { redirect } from 'next/navigation';

import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { getProfile } from '@/server/profile';
import { listJobs } from '@/server/jobs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AwaitingSignaturesCard, type AwaitingSignatureJobCard } from './_components/awaiting-signatures-card';

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

export default async function DashboardPage() {
  const supabase = await supabaseServerReadOnly();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [{ profile }, jobGroups] = await Promise.all([getProfile(), listJobs()]);
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
  const recentPastJobs = [...completedJobs]
    .sort((a, b) => {
      const left = new Date(a.scheduled_for ?? a.created_at ?? '').getTime();
      const right = new Date(b.scheduled_for ?? b.created_at ?? '').getTime();
      return right - left;
    })
    .slice(0, 1);

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

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="border border-white/10">
          <CardHeader>
            <CardTitle className="text-lg text-muted">Upcoming jobs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {nextUpcomingJob ? (
              <div className="rounded-2xl border border-white/10 bg-white/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-muted">{nextUpcomingJob.client_name ?? nextUpcomingJob.title ?? 'Job'}</p>
                    <p className="text-xs text-muted-foreground/70">{nextUpcomingJob.address}</p>
                    <p className="mt-1 text-xs text-muted-foreground/70">
                      {formatDateTime(nextUpcomingJob.scheduled_for ?? '')}
                    </p>
                    {nextUpcomingJob.job_type === 'safety_check' ? (
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
                        {nextUpcomingJob.prepComplete ? 'Ready to start' : 'Step 1 incomplete'}
                      </p>
                    ) : null}
                  </div>
                  <Badge variant="brand" className="uppercase">
                    {nextUpcomingJob.status ?? 'draft'}
                  </Badge>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button asChild variant="secondary" className="rounded-full">
                    <Link href={getUpcomingJobHref(nextUpcomingJob)}>
                      {getUpcomingJobActionLabel(nextUpcomingJob)}
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/70">No upcoming scheduled jobs.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border border-white/10">
          <CardHeader>
            <CardTitle className="text-lg text-muted">Past jobs</CardTitle>
            <CardDescription className="text-sm text-muted-foreground/70">
              Recently completed work and generated PDFs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentPastJobs.length ? (
              <>
                {recentPastJobs.map((job) => (
                  <div key={job.id} className="rounded-2xl border border-white/10 bg-white/40 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-muted">{job.client_name ?? job.title ?? 'Job'}</p>
                        <p className="text-xs text-muted-foreground/70">{job.address}</p>
                        <p className="mt-1 text-xs text-muted-foreground/70">
                          {formatDateTime(job.scheduled_for ?? job.created_at ?? '')}
                        </p>
                      </div>
                      <Badge variant="brand" className="uppercase">
                        {job.status ?? 'completed'}
                      </Badge>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button asChild variant="secondary" className="rounded-full">
                        <Link href={`/jobs/${job.id}/pdf`}>Open PDF</Link>
                      </Button>
                    </div>
                  </div>
                ))}
                <Button asChild variant="secondary" className="rounded-full">
                  <Link href="/jobs">View all jobs</Link>
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground/70">No completed jobs yet.</p>
            )}
          </CardContent>
        </Card>
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
