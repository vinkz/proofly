'use server';

import { supabaseServerAction, supabaseServerServiceRole } from '@/lib/supabaseServer';
import { reportPath } from '@/lib/storage';
import { reportKindForJobType } from '@/types/reports';
import type { Database } from '@/lib/database.types';
import type { JobType } from '@/types/job-records';

export async function savePdfToDocuments({
  jobId,
  pdfPath,
}: {
  jobId: string;
  pdfPath: string | null;
}) {
  if (!pdfPath) throw new Error('No PDF available');

  const sb = await supabaseServerAction();
  const {
    data: { user },
    error: authErr,
  } = await sb.auth.getUser();
  if (authErr || !user) throw new Error(authErr?.message ?? 'Unauthorized');

  const { data: job, error: jobErr } = await sb
    .from('jobs')
    .select('id, user_id, job_type')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (jobErr) throw new Error(jobErr.message);
  if (!job) throw new Error('Job not found');

  const admin = await supabaseServerServiceRole();
  const destinationPath = reportPath(jobId);

  if (!pdfPath.startsWith('reports/')) {
    const { data: sourceFile, error: downloadErr } = await admin.storage.from('certificates').download(pdfPath);
    if (downloadErr || !sourceFile) throw new Error(downloadErr?.message ?? 'Unable to download PDF');
    const buffer = Buffer.from(await sourceFile.arrayBuffer());
    const { error: uploadErr } = await admin.storage
      .from('reports')
      .upload(destinationPath, buffer, { contentType: 'application/pdf', upsert: true });
    if (uploadErr) throw new Error(uploadErr.message);
  }

  await admin.from('reports').delete().eq('job_id', jobId as Database['public']['Tables']['reports']['Row']['job_id']);

  const insertPayload: Database['public']['Tables']['reports']['Insert'] = {
    job_id: jobId as Database['public']['Tables']['reports']['Row']['job_id'],
    storage_path: destinationPath,
    generated_at: new Date().toISOString(),
    kind: reportKindForJobType(job.job_type as JobType),
  };
  const { error: insertErr } = await admin.from('reports').insert(insertPayload);
  if (insertErr) throw new Error(insertErr.message);

  return { ok: true };
}
