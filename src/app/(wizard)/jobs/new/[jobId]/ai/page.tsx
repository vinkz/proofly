import { notFound } from 'next/navigation';

import { getJobWizardState } from '@/server/jobs';
import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { WizardShell } from '@/components/job-wizard/wizard-shell';
import { GenerateWizardReportButton } from '@/components/job-wizard/report-action';
import { ShareReportLinkButton } from '@/components/report/share-link-button';
import { isUUID } from '@/lib/ids';
import { reportKindForJobType } from '@/types/reports';

export default async function AiStepPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!isUUID(jobId)) notFound();

  const state = await getJobWizardState(jobId);
  const supabase = await supabaseServerReadOnly();
  const reportKind = reportKindForJobType(state.job.job_type ?? null);
  let signedReportUrl: string | null = null;
  if (state.report?.storage_path) {
    const { data } = await supabase.storage.from('reports').createSignedUrl(state.report.storage_path, 60 * 10);
    signedReportUrl = data?.signedUrl ?? null;
  }

  return (
    <WizardShell jobId={jobId} currentStep="ai" job={state.job} client={state.client} template={state.template}>
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--accent)]">Step 7</p>
          <h1 className="text-2xl font-semibold text-muted">AI report generation</h1>
          <p className="text-sm text-muted-foreground/70">
            certnow assembles the checklist data, photos, and signatures into a polished PDF.
          </p>
        </div>

        {signedReportUrl ? (
          <div className="rounded-2xl border border-white/20 bg-white/70 p-4 text-sm text-muted-foreground/80">
            <p className="font-semibold text-emerald-700">Report ready</p>
            <p>Your AI summary and PDF have been generated. Review below or continue to delivery.</p>
            <div className="mt-3 flex gap-3">
              <a
                href={signedReportUrl}
                target="_blank"
                className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
              >
                Preview PDF
              </a>
              <ShareReportLinkButton jobId={jobId} />
            </div>
            {state.job.notes ? (
              <div className="mt-4 rounded-xl border border-white/20 bg-white/80 p-3 text-sm text-muted-foreground/90">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                  AI summary
                </p>
                <p className="mt-2 whitespace-pre-line">{state.job.notes}</p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/40 p-6 text-center">
            <p className="text-lg font-semibold text-muted">Generate AI summary</p>
            <p className="text-sm text-muted-foreground/70">
              We send the checklist outcomes to the AI assistant and compile a PDF with photos + signatures.
            </p>
            <div className="mt-4 flex justify-center">
              <GenerateWizardReportButton jobId={jobId} reportKind={reportKind} />
            </div>
          </div>
        )}
      </div>
    </WizardShell>
  );
}
