'use server';

import type { supabaseServerAction, supabaseServerServiceRole } from '@/lib/supabaseServer';
import type { Database } from '@/lib/database.types';

type JobFieldsClient =
  | Awaited<ReturnType<typeof supabaseServerAction>>
  | Awaited<ReturnType<typeof supabaseServerServiceRole>>;

const JOB_FIELDS_TABLE = 'job_fields' as const;

export type JobFieldEntry = { job_id: string; field_key: string; value: string | null };

export async function persistJobFields(sb: JobFieldsClient, jobId: string, entries: JobFieldEntry[], label: string) {
  if (!entries.length) return;
  const keys = entries.map((e) => e.field_key);
  console.log(`${label}: deleting existing job_fields`, { jobId, keys });
  const { error: delErr } = await sb.from(JOB_FIELDS_TABLE).delete().eq('job_id', jobId).in('field_key', keys);
  if (delErr) {
    console.error(`${label}: delete job_fields failed`, { jobId, error: delErr });
    throw new Error(delErr.message);
  }
  const insertPayload = entries as unknown as Database['public']['Tables']['job_fields']['Insert'][];
  const { data, error: insErr } = await sb.from(JOB_FIELDS_TABLE).insert(insertPayload).select();
  console.log(`${label}: inserted job_fields`, { jobId, count: data?.length ?? 0, error: insErr });
  if (insErr) {
    throw new Error(insErr.message);
  }
}
