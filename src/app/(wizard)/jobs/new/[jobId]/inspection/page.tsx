import { notFound, redirect } from 'next/navigation';

import { getJobWizardState } from '@/server/jobs';
import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { WizardShell } from '@/components/job-wizard/wizard-shell';
import { InspectionFlow } from '@/components/job-wizard/inspection-flow';
import { isUUID } from '@/lib/ids';

export default async function InspectionStep({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!isUUID(jobId)) notFound();

  const state = await getJobWizardState(jobId);
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

  const supabase = await supabaseServerReadOnly();
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
