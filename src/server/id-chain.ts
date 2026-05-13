import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import type { CertificateType } from '@/types/certificates';

type DbClient = SupabaseClient<Database>;
type UntypedQuery = {
  select: (columns?: string) => UntypedQuery;
  insert: (payload: Record<string, unknown>) => UntypedQuery;
  update: (payload: Record<string, unknown>) => UntypedQuery;
  eq: (column: string, value: unknown) => UntypedQuery;
  order: (column: string, options?: { ascending?: boolean }) => UntypedQuery;
  limit: (count: number) => UntypedQuery;
  maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { code?: string; message: string } | null }>;
  then: Promise<{ data: unknown; error: { code?: string; message: string } | null }>['then'];
};
type UntypedClient = {
  from: (table: string) => UntypedQuery;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message: string } | null }>;
};

const CERTIFICATE_TOKENS: Record<CertificateType, string> = {
  cp12: 'CP12',
  gas_service: 'SERVICE',
  general_works: 'GENERAL',
  gas_warning_notice: 'WARNING',
  breakdown: 'BREAKDOWN',
  commissioning: 'COMMISSIONING',
};

export async function getNextJobCode(sb: DbClient, userId: string) {
  const client = sb as unknown as UntypedClient;
  const { data, error } = await client.rpc('next_job_code', { p_user_id: userId });
  if (error) {
    return getNextJobCodeFromCounter(client, userId, error.message);
  }
  return String(data);
}

async function getNextJobCodeFromCounter(client: UntypedClient, userId: string, rpcErrorMessage: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: counter, error: readErr } = await client
      .from('job_code_counters')
      .select('seq')
      .eq('user_id', userId)
      .maybeSingle();
    if (readErr && readErr.code !== 'PGRST116') throw new Error(readErr.message || rpcErrorMessage);

    const currentSeq = typeof counter?.seq === 'number' ? counter.seq : null;
    if (currentSeq === null) {
      const { error: insertErr } = await client
        .from('job_code_counters')
        .insert({ user_id: userId, seq: 1 });
      if (!insertErr) return '00000001';
      if (insertErr.code !== '23505') throw new Error(insertErr.message || rpcErrorMessage);
      continue;
    }

    const nextSeq = currentSeq + 1;
    const { data: updated, error: updateErr } = await client
      .from('job_code_counters')
      .update({ seq: nextSeq })
      .eq('user_id', userId)
      .eq('seq', currentSeq)
      .select('seq')
      .maybeSingle();
    if (updateErr && updateErr.code !== 'PGRST116') throw new Error(updateErr.message || rpcErrorMessage);
    if (typeof updated?.seq === 'number') return String(updated.seq).padStart(8, '0');
  }

  const { data: latestJob, error: latestErr } = await client
    .from('jobs')
    .select('job_code')
    .eq('user_id', userId)
    .order('job_code', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestErr && latestErr.code !== 'PGRST116') throw new Error(latestErr.message || rpcErrorMessage);
  const latestSeq = Number.parseInt(String(latestJob?.job_code ?? '0'), 10);
  return String(Number.isFinite(latestSeq) ? latestSeq + 1 : 1).padStart(8, '0');
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
