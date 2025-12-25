import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';

type JobSheetRow = Database['public']['Tables']['job_sheets']['Row'];
type JobSheetInsert = Database['public']['Tables']['job_sheets']['Insert'];

const JOB_SHEETS_TABLE = 'job_sheets';
const CODE_PREFIX = 'CN-';
const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const normalizeCode = (code: string) => code.trim().toUpperCase();

export function generateJobSheetCode(): string {
  const bytes = randomBytes(6);
  const suffix = Array.from(bytes, (byte) => CODE_CHARS[byte % CODE_CHARS.length]).join('');

  return `${CODE_PREFIX}${suffix}`;
}

export async function createJobSheetForJob(
  supabase: SupabaseClient<Database>,
  jobId: string,
): Promise<Pick<JobSheetRow, 'id' | 'code'>> {
  if (!jobId.trim()) {
    throw new Error('Invalid job id');
  }

  const { data: existing, error } = await supabase
    .from(JOB_SHEETS_TABLE)
    .select('id, code, is_active')
    .eq('job_id', jobId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (existing) {
    return { id: existing.id, code: existing.code };
  }

  const code = generateJobSheetCode();
  const insertPayload: JobSheetInsert = {
    job_id: jobId,
    code,
    is_active: true,
  };

  const { data: inserted, error: insertError } = await supabase
    .from(JOB_SHEETS_TABLE)
    .insert(insertPayload)
    .select('id, code')
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  if (!inserted) {
    throw new Error('Failed to create job sheet');
  }

  return { id: inserted.id, code: inserted.code };
}

export async function lookupJobBySheetCode(
  supabase: SupabaseClient<Database>,
  code: string,
): Promise<{ jobId: string; isActive: boolean } | null> {
  const normalized = normalizeCode(code);
  if (!normalized) {
    return null;
  }

  const { data, error } = await supabase
    .from(JOB_SHEETS_TABLE)
    .select('job_id, is_active')
    .eq('code', normalized)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return { jobId: data.job_id, isActive: data.is_active };
}
