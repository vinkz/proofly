'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

import { JobCard } from './job-card';
import { CertificateTypeModal } from '@/components/certificates/certificate-type-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DeleteAllJobsButton } from './delete-all-jobs-button';

export type JobSummary = {
  id: string;
  title: string;
  address?: string | null;
  status?: string | null;
  certificate_type?: string | null;
  created_at?: string | null;
  scheduled_for?: string | null;
  has_pdf?: boolean;
};

type FilterRange = 'today' | 'week' | 'all';

export function JobsCommandCentre({ jobs }: { jobs: JobSummary[] }) {
  const [query, setQuery] = useState('');
  const [range, setRange] = useState<FilterRange>('all');

  const filtered = useMemo(() => {
    const now = new Date();
    return jobs.filter((job) => {
      const haystack = `${job.title ?? ''} ${job.address ?? ''}`.toLowerCase();
      const matchesQuery = haystack.includes(query.toLowerCase());

      let matchesRange = true;
      const when = job.scheduled_for ?? job.created_at;
      if (when && range !== 'all') {
        const date = new Date(when);
        if (range === 'today') {
          matchesRange = date.toDateString() === now.toDateString();
        } else if (range === 'week') {
          const diff = Math.abs(date.getTime() - now.getTime());
          matchesRange = diff <= 7 * 24 * 60 * 60 * 1000;
        }
      }
      return matchesQuery && matchesRange;
    });
  }, [jobs, query, range]);

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
            {(['today', 'week', 'all'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRange(value)}
                className={`rounded-full px-3 py-2 text-xs font-semibold uppercase ${
                  range === value ? 'bg-[var(--accent)] text-white' : 'bg-[var(--muted)] text-gray-700'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CertificateTypeModal />
          <Button asChild variant="secondary" className="rounded-full px-4 py-2">
            <Link href="/jobs/scan">Scan Job Sheet</Link>
          </Button>
          <DeleteAllJobsButton />
        </div>
      </div>

      <div className="grid gap-3">
        {filtered.map((job) => (
          <JobCard
            key={job.id}
            id={job.id}
            title={job.title ?? 'Untitled job'}
            address={job.address}
            status={job.status}
            certificateType={job.certificate_type}
            hasPdf={job.has_pdf}
            onDeleted={() => {
              // Optimistic local removal
              // (full refresh still happens after delete on server)
            }}
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
