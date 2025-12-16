'use client';

import { useRouter } from 'next/navigation';

import type { Database } from '@/lib/database.types';
import { Button } from '@/components/ui/button';
import { DeleteJobButton } from '@/components/jobs/delete-job-button';

type JobRow = Database['public']['Tables']['jobs']['Row'];

export default function JobsTable({ jobs }: { jobs: JobRow[] }) {
  const router = useRouter();

  const handleRowClick = (job: JobRow) => {
    const href = job.status === 'completed' ? `/reports/${job.id}` : resumeHref(job);
    router.push(href);
  };

  return (
    <div className="rounded-3xl border border-white/20 bg-white/80 p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-muted">Job list</h2>
          <p className="text-xs text-muted-foreground/60">{jobs.length} records</p>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-white/10 text-sm" role="table" aria-label="Jobs list">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-muted-foreground/60">
              <th scope="col" className="px-3 py-2 text-left">
                Client
              </th>
              <th scope="col" className="px-3 py-2 text-left">
                Title
              </th>
              <th scope="col" className="px-3 py-2 text-left">
                Scheduled
              </th>
              <th scope="col" className="px-3 py-2 text-left">
                Status
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {jobs.map((job) => (
              <tr
                key={job.id}
                className="cursor-pointer transition hover:bg-white/5"
                onClick={() => handleRowClick(job)}
              >
                <td className="px-3 py-3 font-semibold text-muted">{job.client_name}</td>
                <td className="px-3 py-3 text-muted-foreground/80">{job.title ?? 'Untitled job'}</td>
                <td className="px-3 py-3 text-muted-foreground/70">
                  {job.scheduled_for ? new Date(job.scheduled_for).toLocaleString() : 'Not scheduled'}
                </td>
                <td className="px-3 py-3">
                  <StatusBadge status={job.status ?? 'draft'} />
                </td>
                <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button asChild variant="outline">
                      <a href={resumeHref(job)}>{job.status === 'completed' ? 'Report' : 'Open'}</a>
                    </Button>
                    <DeleteJobButton jobId={job.id} />
                  </div>
                </td>
              </tr>
            ))}
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground/70">
                  No jobs match the selected filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function resumeHref(job: JobRow) {
  const certificateType = (job as { certificate_type?: string | null }).certificate_type ?? 'general-works';
  if (job.status === 'completed') return `/jobs/${job.id}/pdf`;
  return `/wizard/create/${certificateType}?jobId=${job.id}`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: 'bg-muted/40 text-muted-foreground',
    active: 'bg-[var(--accent)]/10 text-[var(--accent)]',
    awaiting_signatures: 'bg-amber-100 text-amber-700',
    awaiting_report: 'bg-sky-100 text-sky-700',
    completed: 'bg-emerald-100 text-emerald-700',
  };
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${map[status] ?? 'bg-muted'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
