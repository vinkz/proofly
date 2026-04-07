'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

import { buildCertificateResumeHref } from '@/lib/certificate-resume';
import { JobCard } from './job-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DeleteJobsMenu } from './delete-jobs-menu';
import type { JobType } from '@/types/job-records';

export type JobSummary = {
  id: string;
  title: string;
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

export function JobsCommandCentre({ jobs, showActions = true }: { jobs: JobSummary[]; showActions?: boolean }) {
  const [query, setQuery] = useState('');
  const [view, setView] = useState<FilterView>('upcoming');

  const filtered = useMemo(() => {
    return jobs
      .filter((job) => {
        const haystack = `${job.title ?? ''} ${job.address ?? ''}`.toLowerCase();
        const matchesQuery = haystack.includes(query.toLowerCase());

        let matchesView = true;
        if (view === 'upcoming') matchesView = job.status !== 'completed';
        if (view === 'past') matchesView = job.status === 'completed';
        return matchesQuery && matchesView;
      })
      .sort((a, b) => {
        const left = getJobTimestamp(a);
        const right = getJobTimestamp(b);
        if (left === null && right === null) return 0;
        if (left === null) return 1;
        if (right === null) return -1;

        const leftUpcoming = a.status !== 'completed';
        const rightUpcoming = b.status !== 'completed';
        if (view === 'past') return right - left;
        if (view === 'upcoming') return leftUpcoming && rightUpcoming ? left - right : leftUpcoming ? -1 : 1;
        if (leftUpcoming !== rightUpcoming) return leftUpcoming ? -1 : 1;
        return leftUpcoming ? left - right : right - left;
      });
  }, [jobs, query, view]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-3xl border border-white/30 bg-white/80 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search jobs"
            className="flex-1 rounded-full"
          />
          <div className="flex items-center gap-2">
            {(['upcoming', 'past', 'all'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setView(value)}
                className={`rounded-full px-3 py-2 text-xs font-semibold uppercase ${
                  view === value ? 'bg-[var(--accent)] text-white' : 'bg-[var(--muted)] text-gray-700'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        {showActions ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="primary" className="rounded-full px-4 py-2">
              <Link href="/jobs/new">+ New Job</Link>
            </Button>
            <Button asChild variant="secondary" className="rounded-full px-4 py-2">
              <Link href="/jobs/scan">Scan Job Sheet</Link>
            </Button>
            <DeleteJobsMenu jobs={jobs} />
          </div>
        ) : null}
      </div>

      <div className="grid gap-3">
        {filtered.map((job) => (
          <JobCard
            key={job.id}
            href={
              job.status === 'completed'
                ? `/jobs/${job.id}/pdf`
                : buildCertificateResumeHref({
                    jobId: job.id,
                    jobType: job.job_type as JobType | null | undefined,
                  })
            }
            title={job.title ?? 'Untitled job'}
            address={job.address}
            status={job.status}
            hasPdf={job.has_pdf}
            scheduledFor={job.scheduled_for}
            createdAt={job.created_at}
          />
        ))}
        {filtered.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-white/40 p-6 text-sm text-muted-foreground/70">
            No jobs match this filter.
          </p>
        ) : null}
      </div>
    </div>
  );
}
