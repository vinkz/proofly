import { listJobs } from '@/server/jobs';
import { JobsCommandCentre, type JobSummary } from '@/components/jobs/jobs-command-centre';

export default async function JobsIndexPage() {
  const { active, completed } = await listJobs();
  const mapped: JobSummary[] = [...active, ...completed].map((job: any) => ({
    id: job.id,
    title: job.title ?? job.client_name ?? 'Untitled job',
    address: job.address ?? job.client_address ?? null,
    status: job.status ?? 'draft',
    certificate_type: job.certificate_type ?? job.template_id ?? null,
    created_at: job.created_at ?? null,
    scheduled_for: job.scheduled_for ?? null,
    has_pdf: Boolean(job.report_storage_path),
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-wide text-[var(--accent)]">Jobs command centre</p>
        <h1 className="text-3xl font-semibold text-muted">Certificates & inspections</h1>
        <p className="text-sm text-muted-foreground/70">Create certificates, scan job sheets, and capture on-site checks.</p>
      </div>
      <JobsCommandCentre jobs={mapped} />
    </div>
  );
}
