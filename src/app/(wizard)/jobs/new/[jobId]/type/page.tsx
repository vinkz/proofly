import { notFound, redirect } from 'next/navigation';

import { getJobWizardState, setJobType } from '@/server/jobs';
import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { WizardShell } from '@/components/job-wizard/wizard-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { isUUID } from '@/lib/ids';
import { DEFAULT_JOB_TYPE, JOB_TYPES, type JobType } from '@/types/job-records';

const JOB_TYPE_OPTIONS: Array<{
  value: JobType;
  label: string;
  description: string;
}> = [
  { value: 'safety_check', label: 'Safety check', description: 'Routine safety inspection.' },
  { value: 'service', label: 'Service', description: 'Planned service visit or tune-up.' },
  { value: 'breakdown', label: 'Breakdown', description: 'Urgent callout for a fault or issue.' },
  { value: 'installation', label: 'Installation', description: 'New appliance or system install.' },
  { value: 'general', label: 'General', description: 'General work that does not fit other types.' },
];

export default async function JobTypeStepPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!isUUID(jobId)) notFound();

  const state = await getJobWizardState(jobId);
  const supabase = await supabaseServerReadOnly();
  const { data: jobRow, error: jobErr } = await supabase
    .from('jobs')
    .select('job_type')
    .eq('id', jobId)
    .maybeSingle();

  if (jobErr) throw new Error(jobErr.message);

  const jobTypeValue =
    jobRow && typeof (jobRow as { job_type?: string | null }).job_type === 'string'
      ? (jobRow as { job_type?: string | null }).job_type
      : null;
  const resolvedJobType =
    jobTypeValue && JOB_TYPES.includes(jobTypeValue as JobType)
      ? (jobTypeValue as JobType)
      : DEFAULT_JOB_TYPE;

  const handleSelect = async (formData: FormData) => {
    'use server';
    const selected = formData.get('job_type');
    if (typeof selected !== 'string') {
      throw new Error('Select a job type to continue.');
    }
    await setJobType(jobId, selected as JobType);
    redirect(`/jobs/new/${jobId}/template`);
  };

  return (
    <WizardShell jobId={jobId} currentStep="type" job={state.job} client={state.client} template={state.template}>
      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--accent)]">Step 2</p>
          <h1 className="text-2xl font-semibold text-muted">Select job type</h1>
          <p className="text-sm text-muted-foreground/70">
            Pick the closest match. You can refine this later.
          </p>
        </div>
        <form action={handleSelect} className="space-y-3">
          {JOB_TYPE_OPTIONS.map((option) => (
            <Card
              key={option.value}
              className="flex flex-col gap-3 border border-white/30 bg-white/70 p-4 shadow-sm"
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="radio"
                  name="job_type"
                  value={option.value}
                  defaultChecked={resolvedJobType === option.value}
                  className="mt-1 h-4 w-4 accent-[var(--accent)]"
                />
                <div>
                  <p className="text-base font-semibold text-muted">{option.label}</p>
                  <p className="text-xs text-muted-foreground/70">{option.description}</p>
                </div>
              </label>
            </Card>
          ))}
          <div className="flex justify-end">
            <Button type="submit">Continue</Button>
          </div>
        </form>
      </div>
    </WizardShell>
  );
}
