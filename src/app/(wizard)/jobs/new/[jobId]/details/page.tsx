import { notFound } from 'next/navigation';

import { getJobWizardState } from '@/server/jobs';
import { WizardShell } from '@/components/job-wizard/wizard-shell';
import { JobDetailsForm } from '@/components/job-wizard/details-form';
import { isUUID } from '@/lib/ids';

export default async function JobDetailsStep({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!isUUID(jobId)) notFound();

  const state = await getJobWizardState(jobId);
  const defaults = {
    title: state.job.title ?? `${state.client?.name ?? 'New'} inspection`,
    scheduled_for: toDatetimeLocal(state.job.scheduled_for),
    technician_name: state.job.technician_name ?? '',
    notes: state.job.notes ?? '',
  };

  return (
    <WizardShell jobId={jobId} currentStep="details" job={state.job} client={state.client} template={state.template}>
      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--accent)]">Step 4</p>
          <h1 className="text-2xl font-semibold text-muted">Job details</h1>
          <p className="text-sm text-muted-foreground/70">
            Schedule the visit and assign who will complete the checklist.
          </p>
        </div>
        <JobDetailsForm jobId={jobId} defaultValues={defaults} />
      </div>
    </WizardShell>
  );
}

function toDatetimeLocal(value: string | null) {
  if (!value) {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  }
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}
