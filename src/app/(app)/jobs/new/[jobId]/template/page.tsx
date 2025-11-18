import { notFound } from 'next/navigation';

import { getJobWizardState } from '@/server/jobs';
import { listVisibleTemplates } from '@/server/templates';
import { WizardShell } from '@/components/job-wizard/wizard-shell';
import { TemplateSection } from '@/components/job-wizard/template-step';
import { isUUID } from '@/lib/ids';

export default async function TemplateStepPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!isUUID(jobId)) {
    notFound();
  }

  const [state, templates] = await Promise.all([getJobWizardState(jobId), listVisibleTemplates('plumbing')]);
  const myTemplates = templates.filter((template) => !template.is_public);
  const publicTemplates = templates.filter((template) => template.is_public);

  return (
    <WizardShell jobId={jobId} currentStep="template" job={state.job} client={state.client} template={state.template}>
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--accent)]">Step 2</p>
          <h1 className="text-2xl font-semibold text-muted">Choose a workflow</h1>
          <p className="text-sm text-muted-foreground/70">
            Attach a workflow to generate the inspection checklist for this job.
          </p>
        </div>
        <TemplateSection jobId={jobId} label="My templates" templates={myTemplates} />
        <TemplateSection jobId={jobId} label="Public templates" templates={publicTemplates} />
      </div>
    </WizardShell>
  );
}
