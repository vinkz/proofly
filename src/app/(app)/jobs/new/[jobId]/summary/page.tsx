import { notFound, redirect } from 'next/navigation';

import { getJobWizardState } from '@/server/jobs';
import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { WizardShell } from '@/components/job-wizard/wizard-shell';
import { SignaturePanel } from '@/components/job-wizard/signature-panel';
import { isUUID } from '@/lib/ids';

export default async function SummaryStep({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!isUUID(jobId)) notFound();

  const state = await getJobWizardState(jobId);
  if (!state.template) {
    redirect(`/jobs/new/${jobId}/template`);
  }

  const supabase = await supabaseServerReadOnly();
  const signatureUrls = {
    plumber: state.signatures?.plumber_sig_path
      ? await signedUrl(supabase, 'signatures', state.signatures.plumber_sig_path)
      : null,
    client: state.signatures?.client_sig_path
      ? await signedUrl(supabase, 'signatures', state.signatures.client_sig_path)
      : null,
  };

  const passCount = state.items.filter((item) => item.result === 'pass').length;
  const failCount = state.items.filter((item) => item.result === 'fail').length;
  const pendingCount = state.items.length - passCount - failCount;

  return (
    <WizardShell jobId={jobId} currentStep="summary" job={state.job} client={state.client} template={state.template}>
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--accent)]">Step 5</p>
          <h1 className="text-2xl font-semibold text-muted">Summary & signatures</h1>
          <p className="text-sm text-muted-foreground/70">
            Review checklist outcomes, highlight failures, and capture sign-off.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Pass" value={passCount} tone="pass" />
          <StatCard label="Fail" value={failCount} tone="fail" />
          <StatCard label="Pending" value={pendingCount} tone="neutral" />
        </div>

        <div className="space-y-3 rounded-2xl border border-white/20 bg-white/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground/80">Checklist</h2>
          <ul className="divide-y divide-white/30 text-sm">
            {state.items.map((item) => (
              <li key={item.id} className="flex items-start justify-between py-3">
                <div>
                  <p className="font-medium text-muted">{item.label}</p>
                  {item.note ? <p className="text-xs text-muted-foreground/70">{item.note}</p> : null}
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                    item.result === 'fail'
                      ? 'bg-red-600/10 text-red-600'
                      : item.result === 'pass'
                        ? 'bg-emerald-600/10 text-emerald-600'
                        : 'bg-muted/40 text-muted-foreground'
                  }`}
                >
                  {item.result ?? 'pending'}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <SignaturePanel jobId={jobId} existing={signatureUrls} />
      </div>
    </WizardShell>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: 'pass' | 'fail' | 'neutral' }) {
  const toneClasses =
    tone === 'pass'
      ? 'bg-emerald-50 text-emerald-700'
      : tone === 'fail'
        ? 'bg-red-50 text-red-700'
        : 'bg-muted/40 text-muted-foreground';
  return (
    <div className={`rounded-2xl border border-white/20 p-4 text-center ${toneClasses}`}>
      <p className="text-sm font-semibold uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

async function signedUrl(
  supabase: Awaited<ReturnType<typeof supabaseServerReadOnly>>,
  bucket: 'signatures' | 'photos',
  path: string,
) {
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 10);
  return data?.signedUrl ?? null;
}
