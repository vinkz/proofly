import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import { supabaseServerServiceRole } from '@/lib/supabaseServer';
import { createJobSheetForJob } from '@/server/job-sheets';
import { renderJobSheetPdf, type JobWithCustomerAndAddress } from '@/lib/pdf/job-sheet-template';

type JobRow = Database['public']['Tables']['jobs']['Row'];
type ClientRow = Database['public']['Tables']['clients']['Row'];

const buildPropertyAddress = (address: string | null) => {
  if (!address || !address.trim()) return null;
  return { line1: address.trim(), line2: null, town: null, postcode: null };
};

export async function loadJobSheetContext(
  supabase: SupabaseClient<Database>,
  jobId: string,
  label: string,
): Promise<JobWithCustomerAndAddress> {
  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .select('id, user_id, client_id, client_name, address, scheduled_for, title, created_at')
    .eq('id', jobId as JobRow['id'])
    .maybeSingle();

  if (jobErr || !job) {
    throw new Error(jobErr?.message ?? `${label}: job not found`);
  }

  const jobRow = job as JobWithCustomerAndAddress['job'];
  let customer: JobWithCustomerAndAddress['customer'] = null;

  if (jobRow.client_id) {
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('name, organization')
      .eq('id', jobRow.client_id as ClientRow['id'])
      .maybeSingle();
    if (clientErr) {
      throw new Error(clientErr.message);
    }
    if (client) {
      customer = {
        name: client.name,
        organization: client.organization ?? null,
      };
    }
  }

  const propertyAddress = buildPropertyAddress(jobRow.address ?? null);

  return { job: jobRow, customer, propertyAddress };
}

export async function generateJobSheetPdf(
  jobId: string,
  baseUrl: string,
): Promise<{ pdfBytes: Uint8Array; sheetCode: string }> {
  const supabase = (await supabaseServerServiceRole()) as unknown as SupabaseClient<Database>;
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error(authError?.message ?? 'generateJobSheetPdf requires authenticated user');
  }

  const jobContext = await loadJobSheetContext(supabase, jobId, 'generateJobSheetPdf');
  if (jobContext.job.user_id && jobContext.job.user_id !== user.id) {
    throw new Error('RLS mismatch: job owner does not match auth user');
  }

  const { code } = await createJobSheetForJob(supabase, jobId);
  const pdfBytes = await renderJobSheetPdf({ job: jobContext, sheetCode: code, baseUrl });

  return { pdfBytes, sheetCode: code };
}
