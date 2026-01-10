import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import type { CertificateType } from '@/types/certificates';

type DbClient = SupabaseClient<Database>;

const CERTIFICATE_TOKENS: Record<CertificateType, string> = {
  cp12: 'CP12',
  gas_service: 'SERVICE',
  general_works: 'GENERAL',
  gas_warning_notice: 'WARNING',
  breakdown: 'BREAKDOWN',
  commissioning: 'COMMISSIONING',
};

export async function getNextJobCode(sb: DbClient, userId: string) {
  const { data, error } = await sb.rpc('next_job_code', { p_user_id: userId });
  if (error) throw new Error(error.message);
  return String(data);
}

export async function ensureJobCode(sb: DbClient, jobId: string, userId: string, currentCode?: string | null) {
  if (currentCode && currentCode.trim().length) return currentCode.trim();
  const nextCode = await getNextJobCode(sb, userId);
  const { error } = await sb
    .from('jobs')
    .update({
      job_code: nextCode,
      client_ref: `${nextCode}-01`,
    })
    .eq('id', jobId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  return nextCode;
}

export function buildClientRef(jobCode: string, index = 1) {
  return `${jobCode}-${String(index).padStart(2, '0')}`;
}

export function buildCertificatePublicId(jobCode: string, certificateType: CertificateType, sequence = 1) {
  const token = CERTIFICATE_TOKENS[certificateType] ?? certificateType.toUpperCase();
  return `${jobCode}-${token}-${String(sequence).padStart(2, '0')}`;
}
