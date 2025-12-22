import { listJobs } from '@/server/jobs';
import { JobsCommandCentre, type JobSummary } from '@/components/jobs/jobs-command-centre';

export default async function JobsIndexPage() {
  const { active, completed } = await listJobs();
  const asString = (value: unknown) => (typeof value === 'string' ? value : null);
  const allJobs = [...active, ...completed] as Array<Record<string, unknown>>;
  const mapped: JobSummary[] = allJobs.map((job) => {
    const id = typeof job.id === 'string' ? job.id : '';
    const title = asString(job.title) ?? asString(job.client_name) ?? 'Untitled job';
    const address = asString(job.address) ?? asString(job.client_address);
    const status = asString(job.status) ?? 'draft';
    const certificate_type = asString(job.certificate_type) ?? asString(job.template_id);
    const created_at = asString(job.created_at);
    const scheduled_for = asString(job.scheduled_for);
    const has_pdf = Boolean(job.report_storage_path);

    return {
      id,
      title,
      address,
      status,
      certificate_type,
      created_at,
      scheduled_for,
      has_pdf,
    };
  });

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
