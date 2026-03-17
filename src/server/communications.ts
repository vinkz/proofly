'use server';

import { supabaseServerAction } from '@/lib/supabaseServer';
export async function sendPdfToClient({
  jobId,
  pdfPath: _pdfPath,
}: {
  jobId: string;
  pdfPath: string | null;
}): Promise<{ status: 'SENT' | 'NOT_CONFIGURED'; message?: string }> {
  const sb = await supabaseServerAction();
  const {
    data: { user },
    error: authErr,
  } = await sb.auth.getUser();
  if (authErr || !user) throw new Error(authErr?.message ?? 'Unauthorized');

  const { data: job, error: jobErr } = await sb
    .from('jobs')
    .select('id, user_id, client_id, address, title')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (jobErr) throw new Error(jobErr.message);
  if (!job) throw new Error('Job not found');

  if (!job.client_id) throw new Error('Client not linked to job');
  const { data: client, error: clientErr } = await sb
    .from('clients')
    .select('id, name, email')
    .eq('id', job.client_id)
    .maybeSingle();
  if (clientErr) throw new Error(clientErr.message);
  if (!client?.email) throw new Error('Client email not found');

  const pdfPath = _pdfPath ?? 'missing-pdf-path';

  return {
    status: 'NOT_CONFIGURED',
    message:
      `Email sending is not configured. Add your email provider integration (e.g. Resend/Postmark) and send the message with the PDF at ${pdfPath}.`,
  };
}
