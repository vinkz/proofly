'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { JobCard } from './job-card';
import { Input } from '@/components/ui/input';
import { getLifecycleJobHref, isCompletedJobStatus } from '@/lib/certificate-resume';
import { JOB_TYPE_LABELS, type JobType } from '@/types/job-records';

export type JobSummary = {
  id: string;
  title: string;
  client_name?: string | null;
  address?: string | null;
  status?: string | null;
  created_at?: string | null;
  scheduled_for?: string | null;
  has_pdf?: boolean;
  job_type?: string | null;
};

type FilterView = 'upcoming' | 'past' | 'all';

const getJobTimestamp = (job: JobSummary) => {
  const when = job.scheduled_for ?? job.created_at ?? null;
  if (!when) return null;
  const parsed = new Date(when);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getTime();
};

const formatSearchDateParts = (value: string | null | undefined) => {
  if (!value) return [];
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return [value.toLowerCase()];

  return [
    value.toLowerCase(),
    parsed.toISOString().slice(0, 10).toLowerCase(),
    parsed.toLocaleDateString('en-GB').toLowerCase(),
    parsed.toLocaleDateString('en-US').toLowerCase(),
    parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toLowerCase(),
    parsed.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }).toLowerCase(),
  ];
};

const buildSearchIndex = (job: JobSummary) => {
  const jobTypeLabel =
    job.job_type && job.job_type in JOB_TYPE_LABELS
      ? JOB_TYPE_LABELS[job.job_type as JobType]
      : job.job_type ?? '';

  return [
    job.title,
    job.client_name ?? '',
    job.address ?? '',
    job.status ?? '',
    job.job_type ?? '',
    jobTypeLabel,
    ...formatSearchDateParts(job.scheduled_for),
    ...formatSearchDateParts(job.created_at),
  ]
    .join(' ')
    .toLowerCase();
};

const getJobHref = (job: JobSummary) => {
  return getLifecycleJobHref({
    jobId: job.id,
    status: job.status,
    jobType: job.job_type,
  });
};

const getActionLabel = (status?: string | null) => {
  const s = (status ?? '').toLowerCase();
  if (s === 'issued') return 'Review & send';
  if (isCompletedJobStatus(s)) return 'Open PDF';
  if (s === 'awaiting_landlord') return 'Waiting';
  if (s === 'prepared') return 'Start';
  if (s === 'in_progress' || s === 'active') return 'Continue';
  if (s === 'draft') return 'Prepare';
  return 'Open';
};

const FILTER_LABELS: Record<FilterView, string> = {
  upcoming: 'Upcoming',
  past: 'Past',
  all: 'All',
};

export function JobsCommandCentre({ jobs }: { jobs: JobSummary[] }) {
  const [query, setQuery] = useState('');
  const [view, setView] = useState<FilterView>('upcoming');

  const filtered = useMemo(() => {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);

    return jobs
      .filter((job) => {
        const haystack = buildSearchIndex(job);
        const matchesQuery = terms.every((term) => haystack.includes(term));
        const isDone = isCompletedJobStatus(job.status);
        const matchesView =
          view === 'upcoming' ? !isDone : view === 'past' ? isDone : true;
        return matchesQuery && matchesView;
      })
      .sort((a, b) => {
        const left = getJobTimestamp(a);
        const right = getJobTimestamp(b);
        if (left === null && right === null) return 0;
        if (left === null) return 1;
        if (right === null) return -1;

        const leftDone = isCompletedJobStatus(a.status);
        const rightDone = isCompletedJobStatus(b.status);
        if (view === 'past') return right - left;
        if (view === 'upcoming') return !leftDone && !rightDone ? left - right : leftDone ? 1 : -1;
        if (leftDone !== rightDone) return leftDone ? 1 : -1;
        return leftDone ? right - left : left - right;
      });
  }, [jobs, query, view]);

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <div className="flex items-center justify-between gap-3 pt-1">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">
            Your jobs
          </p>
          <h1 className="mt-0.5 text-[22px] font-semibold tracking-[-0.02em] text-[var(--color-text-primary)]">
            Jobs
          </h1>
        </div>
        <Link
          href="/jobs/new"
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[20px] bg-[var(--color-cta)] px-4 text-[13px] font-medium text-[var(--color-cta-fg)]"
        >
          + New job
        </Link>
      </div>

      <div className="space-y-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, address, type, or date"
          className="h-10 rounded-[10px]"
        />
        <div className="flex gap-1.5">
          {(['upcoming', 'past', 'all'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setView(value)}
              className={`rounded-[8px] px-3 py-1.5 text-[12px] font-medium transition-colors ${
                view === value
                  ? 'bg-[var(--color-action)] text-white'
                  : 'bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {FILTER_LABELS[value]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        {filtered.map((job) => (
          <JobCard
            key={job.id}
            href={getJobHref(job)}
            title={job.title ?? 'Untitled job'}
            address={job.address}
            status={job.status}
            hasPdf={job.has_pdf}
            scheduledFor={job.scheduled_for}
            createdAt={job.created_at}
            jobType={job.job_type}
            actionLabel={getActionLabel(job.status)}
          />
        ))}
        {filtered.length === 0 && jobs.length > 0 ? (
          <div className="rounded-[16px] border-[0.5px] border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-6 text-center">
            <p className="text-[14px] font-medium text-[var(--color-text-primary)]">No jobs match this filter</p>
            <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
              Try a different filter or clear the search.
            </p>
          </div>
        ) : null}
        {jobs.length === 0 ? (
          <div className="rounded-[16px] border-[0.5px] border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-8 text-center">
            <p className="text-[15px] font-medium text-[var(--color-text-primary)]">No jobs yet</p>
            <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
              Create your first job to get started.
            </p>
            <Link
              href="/jobs/new"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-[20px] bg-[var(--color-cta)] px-5 text-[13px] font-medium text-[var(--color-cta-fg)]"
            >
              New job
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
