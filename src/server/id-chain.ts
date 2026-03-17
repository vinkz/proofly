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
  // rpc function is not in generated types yet; call via untyped handle.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any).rpc('next_job_code', { p_user_id: userId });
  if (error) throw new Error(error.message);
  return String(data);
}

export async function ensureJobCode(sb: DbClient, jobId: string, userId: string, currentCode?: string | null) {
  if (currentCode && currentCode.trim().length) return currentCode.trim();
  const nextCode = await getNextJobCode(sb, userId);
  const updatePayload = {
    job_code: nextCode,
    client_ref: `${nextCode}-01`,
  } as Record<string, unknown>;
  const { error } = await sb.from('jobs').update(updatePayload).eq('id', jobId).eq('user_id', userId);
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
