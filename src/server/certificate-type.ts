'use server';

import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { CERTIFICATE_TYPES, type CertificateType } from '@/types/certificates';
import type { Database } from '@/lib/database.types';

type CertificateSource = 'job_row' | 'cp12_inference' | 'unknown';
const CP12_APPLIANCES_TABLE = 'cp12_appliances' as unknown as keyof Database['public']['Tables'];

export type CertificateResolution = {
  certificateType: CertificateType | null;
  source: CertificateSource;
};

export async function resolveCertificateType(jobId: string, existingType?: string | null): Promise<CertificateResolution> {
  const normalized = (existingType ?? '').toLowerCase();
  const candidate = [normalized, normalized.replace(/-/g, '_')].find((value) =>
    CERTIFICATE_TYPES.includes(value as CertificateType),
  );
  if (candidate) {
    console.log('[certificate-type] resolved from job row', { jobId, certificateType: candidate });
    return { certificateType: candidate as CertificateType, source: 'job_row' };
  }

  const readClient = await supabaseServerReadOnly();
  const { data: cp12Rows, error: cp12Err } = await readClient
    .from(CP12_APPLIANCES_TABLE)
    .select('job_id')
    .eq('job_id', jobId)
    .limit(1);
  if (cp12Err) {
    console.warn('[certificate-type] cp12 inference query failed', { jobId, error: cp12Err });
  }

  const applianceRows = (cp12Rows ?? []) as unknown as Array<{ job_id: string }>;
  if (applianceRows.length > 0) {
    console.log('[certificate-type] inferred cp12 from appliances', { jobId });
    return { certificateType: 'cp12', source: 'cp12_inference' };
  }

  console.warn('[certificate-type] unable to resolve certificate type', { jobId, existingType });
  return { certificateType: null, source: 'unknown' };
}
