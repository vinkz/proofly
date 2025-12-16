import { notFound } from 'next/navigation';

import { ShareReportLinkButton } from '@/components/report/share-link-button';
import { ReportEmailForm } from '@/components/report/send-email-form';
import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { getJobWizardState } from '@/server/jobs';
import { isUUID } from '@/lib/ids';

export default async function ReportPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!isUUID(jobId)) {
    return notFound();
  }

  const state = await getJobWizardState(jobId);
  const supabase = await supabaseServerReadOnly();
  let signedReportUrl: string | null = null;
  if (state.report?.storage_path) {
    const { data } = await supabase.storage.from('reports').createSignedUrl(state.report.storage_path, 60 * 10);
    signedReportUrl = data?.signedUrl ?? null;
  }

  const failedItems = state.items.filter((item) => item.result === 'fail');

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Report for {state.job.client_name ?? 'Client'}</h1>
          <p className="text-sm text-gray-500">{state.job.address}</p>
        </div>
        <ShareReportLinkButton jobId={state.job.id} />
      </div>

      <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
        <section className="rounded-3xl border border-white/20 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">PDF Preview</h2>
          {signedReportUrl ? (
            <iframe title="CertNow report" className="mt-3 h-[70vh] w-full rounded-xl border" src={signedReportUrl} />
          ) : (
            <p className="mt-3 rounded border border-dashed p-4 text-sm text-gray-500">
              Generate a report to preview and send it.
            </p>
          )}
        </section>
        <aside className="space-y-4">
          <section className="rounded-3xl border border-white/20 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Summary</h2>
            {state.job.notes ? (
              <p className="mt-2 text-sm text-gray-700 whitespace-pre-line">{state.job.notes}</p>
            ) : (
              <p className="mt-2 text-sm text-gray-500">No AI summary recorded.</p>
            )}
          </section>
          <section className="rounded-3xl border border-white/20 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Failed items</h2>
            <ul className="mt-2 space-y-2 text-sm text-gray-600">
              {failedItems.length === 0 ? (
                <li className="rounded border border-emerald-100 bg-emerald-50 p-3 text-emerald-700">
                  No failed checks 🎉
                </li>
              ) : (
                failedItems.map((item) => (
                  <li key={item.id} className="rounded border border-red-100 bg-red-50 p-3 text-red-700">
                    <p className="font-semibold">{item.label}</p>
                    {item.note ? <p className="text-xs">{item.note}</p> : null}
                  </li>
                ))
              )}
            </ul>
          </section>
          <section className="rounded-3xl border border-white/20 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Send via email</h2>
            <ReportEmailForm jobId={state.job.id} />
          </section>
        </aside>
      </div>
    </div>
  );
}
