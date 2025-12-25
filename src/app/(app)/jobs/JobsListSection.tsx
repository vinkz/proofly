'use client';

import { JobsCommandCentre, type JobSummary } from '@/components/jobs/jobs-command-centre';

const asString = (value: unknown) => (typeof value === 'string' ? value : null);

export function JobsListSection({
  jobs,
  showActions = false,
}: {
  jobs: Array<Record<string, unknown>>;
  showActions?: boolean;
}) {
  const mapped: JobSummary[] = jobs.map((job) => {
    const id = typeof job.id === 'string' ? job.id : '';
    const title = asString(job.title) ?? asString(job.client_name) ?? 'Untitled job';
    const address = asString(job.address) ?? asString(job.client_address);
    const status = asString(job.status) ?? 'draft';
    const created_at = asString(job.created_at);
    const scheduled_for = asString(job.scheduled_for);
    const has_pdf = Boolean(job.report_storage_path);

    return {
      id,
      title,
      address,
      status,
      created_at,
      scheduled_for,
      has_pdf,
    };
  });

  return <JobsCommandCentre jobs={mapped} showActions={showActions} />;
}
