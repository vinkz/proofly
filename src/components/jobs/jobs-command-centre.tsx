'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { JobCard } from './job-card';
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

type FilterView = 'all' | 'active' | 'awaiting' | 'issued' | 'delivered';

const FILTER_LABELS: Record<FilterView, string> = {
  all: 'All',
  active: 'Active',
  awaiting: 'Awaiting landlord',
  issued: 'Issued',
  delivered: 'Delivered',
};

const isActiveStatus = (s: string) => ['draft', 'prepared', 'in_progress', 'active'].includes(s);
const isDeliveredStatus = (s: string) => ['delivered', 'completed', 'closed'].includes(s);

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

const getJobHref = (job: JobSummary) =>
  getLifecycleJobHref({ jobId: job.id, status: job.status, jobType: job.job_type });

const getActionLabel = (status?: string | null) => {
  const s = (status ?? '').toLowerCase();
  if (s === 'issued') return 'Review & send';
  if (isCompletedJobStatus(s)) return 'Review';
  if (s === 'awaiting_landlord') return 'Waiting';
  if (s === 'prepared') return 'Start';
  if (s === 'in_progress' || s === 'active') return 'Continue';
  if (s === 'draft') return 'Prepare';
  return 'Open';
};

const isThisMonth = (job: JobSummary): boolean => {
  const when = job.scheduled_for ?? job.created_at ?? null;
  if (!when) return false;
  const d = new Date(when);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

export function JobsCommandCentre({ jobs }: { jobs: JobSummary[] }) {
  const [query, setQuery] = useState('');
  const [view, setView] = useState<FilterView>('all');

  const filtered = useMemo(() => {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return jobs
      .filter((job) => {
        const s = (job.status ?? '').toLowerCase();
        const haystack = buildSearchIndex(job);
        const matchesQuery = terms.every((term) => haystack.includes(term));
        let matchesView = true;
        if (view === 'active') matchesView = isActiveStatus(s);
        else if (view === 'awaiting') matchesView = s === 'awaiting_landlord';
        else if (view === 'issued') matchesView = s === 'issued';
        else if (view === 'delivered') matchesView = isDeliveredStatus(s);
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
        if (leftDone !== rightDone) return leftDone ? 1 : -1;
        return leftDone ? right - left : left - right;
      });
  }, [jobs, query, view]);

  const statsActive = jobs.filter((j) => isActiveStatus((j.status ?? '').toLowerCase())).length;
  const statsAwaiting = jobs.filter((j) => (j.status ?? '').toLowerCase() === 'awaiting_landlord').length;
  const statsThisMonth = jobs.filter(isThisMonth).length;

  return (
    <div className="min-h-full">
      {/* Page-level header */}
      <div className="border-b-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-[18px] py-[14px]">
          <h1 className="text-[20px] font-medium text-[var(--color-text-primary)]">Jobs</h1>
          <Link
            href="/jobs/new"
            className="flex h-8 w-8 items-center justify-center rounded-full border-[0.5px] border-[var(--color-border-secondary)] text-[var(--color-text-secondary)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span className="sr-only">New job</span>
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Active', value: statsActive, color: '#BA7517' },
            { label: 'Awaiting', value: statsAwaiting, color: 'var(--color-text-secondary)' },
            { label: 'This month', value: statsThisMonth, color: 'var(--color-text-primary)' },
            { label: 'All time', value: jobs.length, color: 'var(--color-text-primary)' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-[12px] bg-[var(--color-background-secondary)] px-[14px] py-3"
            >
              <p
                className="text-[22px] font-medium leading-none"
                style={{ color: stat.color }}
              >
                {stat.value}
              </p>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.4px] text-[var(--color-text-tertiary)]">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, address, type, or date"
            className="h-10 w-full rounded-[10px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] pl-10 pr-3 text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-action)] focus:outline-none"
          />
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(FILTER_LABELS) as FilterView[]).map((value) => {
            const active = view === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setView(value)}
                className={`rounded-full px-3 py-[5px] text-[12px] font-medium transition-colors ${
                  active
                    ? 'border-[0.5px] border-[#1a7a52] bg-[#edf7f2] text-[#1a7a52]'
                    : 'border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] text-[var(--color-text-secondary)]'
                }`}
              >
                {FILTER_LABELS[value]}
              </button>
            );
          })}
        </div>

        {/* Jobs list */}
        <div className="grid gap-2">
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
                className="mt-4 inline-flex h-10 items-center justify-center rounded-[24px] bg-[#111] px-5 text-[13px] font-medium text-white"
              >
                New job
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
