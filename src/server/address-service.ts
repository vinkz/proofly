'use server';
// Addresses: jobs.address is the canonical property address string.

import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import { formatAddressLine } from '@/lib/address';
import { supabaseServerServiceRole } from '@/lib/supabaseServer';

export type JobAddress = {
  id: string;
  line1: string;
  line2: string | null;
  town: string | null;
  postcode: string | null;
  user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const JobId = z.string().uuid();

const normalizeText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

async function resolveUserId(
  sb: SupabaseClient<Database>,
  label: string,
  userIdOverride?: string | null,
) {
  if (userIdOverride) return userIdOverride;
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error) throw new Error(`${label}: ${error.message}`);
  return user?.id ?? null;
}

// This function is now a no-op as job_addresses is legacy.
// It is kept for compatibility with call sites but should be removed in the future.
export async function getJobAddressById(): Promise<JobAddress | null> {
  return null;
}

export async function upsertJobAddressForJob(params: {
  jobId: string;
  fields: { line1?: string; line2?: string; town?: string; postcode?: string };
  sb?: SupabaseClient<Database>;
  userId?: string | null;
}) {
  JobId.parse(params.jobId);
  const sb = params.sb ?? (await supabaseServerServiceRole());
  const userId = await resolveUserId(sb, 'upsertJobAddressForJob', params.userId);
  if (!userId) throw new Error('Unauthorized');

  // Verify the user owns the job they are trying to update
  const { data: job, error: jobErr } = await sb
    .from('jobs')
    .select('id, user_id')
    .eq('id', params.jobId)
    .maybeSingle();

  if (jobErr || !job) throw new Error(jobErr?.message ?? 'Job not found');
  if (job.user_id && job.user_id !== userId) throw new Error('Unauthorized');

  const line1 = normalizeText(params.fields.line1);
  const line2 = normalizeText(params.fields.line2);
  const town = normalizeText(params.fields.town);
  const postcode = normalizeText(params.fields.postcode);

  const formattedAddress = formatAddressLine({ line1, line2, town, postcode });

  if (!formattedAddress) {
    // Return a structure that matches the old return type to avoid breaking call sites
    return { address: null, created: false, updated: false, linked: false };
  }

  const { error: updateErr } = await sb
    .from('jobs')
    .update({ address: formattedAddress })
    .eq('id', params.jobId);

  if (updateErr) {
    throw new Error(updateErr.message);
  }

  // The concept of a separate "JobAddress" is legacy. We return a partial, fake object
  // for compatibility with any calling code that might expect it.
  const pseudoAddress: JobAddress = {
    id: params.jobId, // Fake ID
    line1,
    line2,
    town,
    postcode,
    user_id: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return { address: pseudoAddress, created: false, updated: true, linked: false };
}
