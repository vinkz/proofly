'use server';

import { supabaseServerReadOnly, supabaseServerServiceRole } from '@/lib/supabaseServer';
import { CERTIFICATE_TYPES, type CertificateType } from '@/types/certificates';

type CertificateSource = 'job_row' | 'cp12_inference' | 'unknown';

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
    .from('cp12_appliances')
    .select('job_id')
    .eq('job_id', jobId)
    .limit(1);
  if (cp12Err) {
    console.warn('[certificate-type] cp12 inference query failed', { jobId, error: cp12Err });
  }

  if (cp12Rows && cp12Rows.length > 0) {
    console.log('[certificate-type] inferred cp12 from appliances, backfilling job row', { jobId });
    const serviceClient = await supabaseServerServiceRole();
    const { error: updateErr } = await serviceClient.from('jobs').update({ certificate_type: 'cp12' }).eq('id', jobId);
    if (updateErr) {
      console.error('[certificate-type] backfill update failed', { jobId, error: updateErr });
    }
    return { certificateType: 'cp12', source: 'cp12_inference' };
  }

  console.warn('[certificate-type] unable to resolve certificate type', { jobId, existingType });
  return { certificateType: null, source: 'unknown' };
}
