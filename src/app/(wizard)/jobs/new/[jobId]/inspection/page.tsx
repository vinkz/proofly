import { notFound, redirect } from 'next/navigation';

import { getJobWizardState } from '@/server/jobs';
import { getJobRecord } from '@/server/jobRecords';
import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { WizardShell } from '@/components/job-wizard/wizard-shell';
import { InspectionFlow } from '@/components/job-wizard/inspection-flow';
import { isUUID } from '@/lib/ids';
import { DEFAULT_JOB_TYPE, type JobType } from '@/types/job-records';

export default async function InspectionStep({ params }: { params: Promise<{ jobId: string }> }) {
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

  const record = await getJobRecord(jobId);
  const recordFlags = record?.record ?? {};
  const jobTypeValue =
    jobRow && typeof (jobRow as { job_type?: string | null }).job_type === 'string'
      ? (jobRow as { job_type?: string | null }).job_type
      : null;
  const jobType = jobTypeValue as JobType | null;
  const jobTypeSelected =
    !!jobType &&
    (jobType !== DEFAULT_JOB_TYPE ||
      (recordFlags as { job_type_selected?: boolean }).job_type_selected === true);

  if (!jobTypeSelected) {
    redirect(`/jobs/new/${jobId}/type`);
  }

  if (!state.template) {
    redirect(`/jobs/new/${jobId}/template`);
  }
  if (state.items.length === 0) {
    return (
      <WizardShell jobId={jobId} currentStep="inspection" job={state.job} client={state.client} template={state.template}>
        <div className="rounded-2xl border border-dashed border-white/40 p-6 text-sm text-muted-foreground/70">
          Template has no checklist items. Add items to continue.
        </div>
      </WizardShell>
    );
  }

  const signedPhotos = await Promise.all(
    state.photos.map(async (photo) => {
      if (!photo.checklist_id) return null;
      const { data } = await supabase.storage.from('photos').createSignedUrl(photo.storage_path, 60 * 5);
      if (!data?.signedUrl) return null;
      return { checklist_id: photo.checklist_id, id: photo.id, url: data.signedUrl };
    }),
  );
  const photoMap: Record<string, { id: string; url: string }[]> = {};
  signedPhotos
    .filter(Boolean)
    .forEach((photo) => {
      const entry = photo as { checklist_id: string; id: string; url: string };
      photoMap[entry.checklist_id] = photoMap[entry.checklist_id]
        ? [...photoMap[entry.checklist_id], { id: entry.id, url: entry.url }]
        : [{ id: entry.id, url: entry.url }];
    });

  return (
    <WizardShell jobId={jobId} currentStep="inspection" job={state.job} client={state.client} template={state.template}>
      <InspectionFlow jobId={jobId} items={state.items} photos={photoMap} />
    </WizardShell>
  );
}
