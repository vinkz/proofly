import { notFound } from 'next/navigation';

import { ShareReportLinkButton } from '@/components/report/share-link-button';
import { supabaseServer } from '@/lib/supabaseServer';
import type { Database } from '@/lib/database.types';

type JobRow = Database['public']['Tables']['jobs']['Row'];
type ReportRow = Database['public']['Tables']['reports']['Row'];

const UUID_PATTERN = /^[0-9a-fA-F-]{36}$/;

export default async function ReportPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId: jobIdParam } = await params;
  if (!UUID_PATTERN.test(jobIdParam)) {
    return notFound();
  }

  const supabase = await supabaseServer();
  const jobId = jobIdParam as JobRow['id'];
  const reportJobId = jobIdParam as ReportRow['job_id'];

  const [{ data: job, error: jobError }, { data: report, error: reportError }] = await Promise.all([
    supabase.from('jobs').select('id, user_id, client_name, address, status, notes').eq('id', jobId).maybeSingle(),
    supabase
      .from('reports')
      .select('id, job_id, storage_path, created_at')
      .eq('job_id', reportJobId)
      .maybeSingle(),
  ]);

  if (jobError) throw jobError;
  const jobRecord = job as JobRow | null;
  if (!jobRecord) return notFound();

  if (reportError) throw reportError;
  const reportRecord = report as ReportRow | null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user && jobRecord.user_id && jobRecord.user_id !== user.id) {
    return notFound();
  }

  let signedReportUrl: string | null = null;
  if (reportRecord?.storage_path) {
    const { data: signed } = await supabase.storage.from('reports').createSignedUrl(reportRecord.storage_path, 600);
    signedReportUrl = signed?.signedUrl ?? null;
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Report for {jobRecord.client_name ?? 'Client'}</h1>
          <p className="text-sm text-gray-500">{jobRecord.address}</p>
        </div>
        <ShareReportLinkButton jobId={jobRecord.id} />
      </div>

      {jobRecord.notes ? (
        <section className="rounded-xl border bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Notes</h2>
          <p className="mt-2 text-sm text-gray-700">{jobRecord.notes}</p>
        </section>
      ) : null}

      {signedReportUrl ? (
        <iframe title="PlumbLog report" className="h-[80vh] w-full rounded-xl border" src={signedReportUrl} />
      ) : (
        <div className="rounded-xl border border-dashed p-6 text-sm text-gray-500">No report generated yet.</div>
      )}
    </div>
  );
}
