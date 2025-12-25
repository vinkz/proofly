import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

import { getJobWizardState } from '@/server/jobs';
import { WizardShell } from '@/components/job-wizard/wizard-shell';
import { CERTIFICATE_LABELS, CERTIFICATE_TYPES } from '@/types/certificates';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { isUUID } from '@/lib/ids';

export default async function TemplateStepPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!isUUID(jobId)) notFound();

  const state = await getJobWizardState(jobId);

  return (
    <WizardShell jobId={jobId} currentStep="template" job={state.job} client={state.client} template={state.template}>
      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--accent)]">Step 3</p>
          <h1 className="text-2xl font-semibold text-muted">Select an output</h1>
          <p className="text-sm text-muted-foreground/70">
            Choose a certificate now, or skip and set it later.
          </p>
        </div>
        <Card className="space-y-3 border border-white/50 bg-white/95 p-4 shadow">
          {CERTIFICATE_TYPES.map((type) => (
            <Link
              key={type}
              href={`/wizard/create/${type}?jobId=${jobId}`}
              className="group flex w-full items-center justify-between rounded-2xl border border-white/30 bg-[var(--muted)]/60 px-4 py-3 text-left shadow-sm transition hover:border-[var(--accent)] hover:bg-white"
            >
              <div>
                <p className="text-sm font-semibold text-muted">{CERTIFICATE_LABELS[type]}</p>
                <p className="text-xs text-muted-foreground/70">
                  Create a new {CERTIFICATE_LABELS[type]}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground/50 transition-transform group-hover:translate-x-1" />
            </Link>
          ))}
        </Card>
        <div className="flex justify-end">
          <Button asChild variant="outline">
            <Link href={`/jobs/new/${jobId}/details`}>Skip for now</Link>
          </Button>
        </div>
      </div>
    </WizardShell>
  );
}
