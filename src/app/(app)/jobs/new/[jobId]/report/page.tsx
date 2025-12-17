import { notFound } from 'next/navigation';

import { getJobWizardState } from '@/server/jobs';
import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { WizardShell } from '@/components/job-wizard/wizard-shell';
import { ReportEmailForm } from '@/components/report/send-email-form';
import { ShareReportLinkButton } from '@/components/report/share-link-button';
import { isUUID } from '@/lib/ids';

export default async function WizardReportPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!isUUID(jobId)) notFound();

  const state = await getJobWizardState(jobId);
  const supabase = await supabaseServerReadOnly();
  let signedReportUrl: string | null = null;
  if (state.report?.storage_path) {
    const { data } = await supabase.storage.from('reports').createSignedUrl(state.report.storage_path, 60 * 15);
    signedReportUrl = data?.signedUrl ?? null;
  }

  const failedItems = state.items.filter((item) => item.result === 'fail');

  return (
    <WizardShell jobId={jobId} currentStep="report" job={state.job} client={state.client} template={state.template}>
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--accent)]">Step 7</p>
          <h1 className="text-2xl font-semibold text-muted">Report delivery</h1>
          <p className="text-sm text-muted-foreground/70">
            Final review, download, and email the completed PDF to stakeholders.
          </p>
        </div>

        <div className="rounded-2xl border border-white/20 bg-white/80 p-4 shadow-inner">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-muted">PDF preview</p>
              <p className="text-xs text-muted-foreground/60">
                {state.report?.generated_at
                  ? `Generated on ${new Date(state.report.generated_at).toLocaleString()}`
                  : 'No report yet'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {signedReportUrl ? (
              <a
                href={signedReportUrl}
                target="_blank"
                className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
              >
                Download PDF
                </a>
              ) : null}
              <ShareReportLinkButton jobId={jobId} />
            </div>
          </div>
          {signedReportUrl ? (
            <iframe
              key={signedReportUrl}
              src={signedReportUrl}
              title="certnow report preview"
              className="mt-4 h-[420px] w-full rounded-xl border border-white/30"
            />
          ) : (
            <p className="mt-4 rounded border border-dashed border-white/30 p-4 text-sm text-muted-foreground/70">
              Generate the report in the previous step to preview it here.
            </p>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="rounded-2xl border border-white/20 bg-white/70 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground/70">
              Findings summary
          </h2>
            <ul className="mt-3 grid gap-3 text-sm text-muted-foreground/80">
              {failedItems.map((item) => (
                <li key={item.id} className="rounded-xl border border-red-100 bg-red-50 p-3">
                  <p className="font-semibold text-red-700">{item.label}</p>
                  {item.note ? <p className="text-xs text-red-600">{item.note}</p> : null}
                </li>
              ))}
              {failedItems.length === 0 ? (
                <li className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-emerald-700">
                  No failed checks on this job.
                </li>
              ) : null}
            </ul>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/80 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground/70">
              Send via email
            </h2>
            <p className="text-xs text-muted-foreground/60">Queue delivery to your client from certnow.</p>
            <div className="mt-3">
              <ReportEmailForm jobId={jobId} />
            </div>
          </div>
        </div>
      </div>
    </WizardShell>
  );
}
