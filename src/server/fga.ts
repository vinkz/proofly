'use server';

import { supabaseServerAction } from '@/lib/supabaseServer';
import { persistJobFields } from '@/server/job-fields';

export type SaveFgaReadingsInput = {
  jobId: string;
  applianceId: string;
  readingSet: 'high' | 'low';
  source: 'pasted_text' | 'manual' | 'csv_import';
  rawText?: string | null;
  data: {
    co_ppm?: number;
    co2_pct?: number;
    o2_pct?: number;
    ratio?: number;
    flue_temp_c?: number;
    ambient_temp_c?: number;
    efficiency_pct?: number;
  };
};

type FgaReadingRow = {
  id: string;
  job_id: string;
  appliance_id: string | null;
  reading_set: string;
  source: string;
  raw_text: string | null;
  data: Record<string, unknown>;
  created_at: string;
};

export async function saveFgaReadings(input: SaveFgaReadingsInput): Promise<FgaReadingRow> {
  const sb = await supabaseServerAction();
  const {
    data: { user },
    error: authErr,
  } = await sb.auth.getUser();
  if (authErr || !user) throw new Error(authErr?.message ?? 'Unauthorized');

  // fga_readings is newly added and not yet in generated types; use an untyped handle.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anySb = sb as any;

  const { data: job, error: jobErr } = await sb
    .from('jobs')
    .select('id')
    .eq('id', input.jobId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (jobErr) throw new Error(jobErr.message);
  if (!job) throw new Error('Job not found');

  const applianceId = input.applianceId?.trim() ? input.applianceId : null;

  const { data: inserted, error: insertErr } = await anySb
    .from('fga_readings')
    .insert({
      job_id: input.jobId,
      appliance_id: applianceId,
      reading_set: input.readingSet,
      source: input.source,
      raw_text: input.rawText ?? null,
      data: input.data ?? {},
    })
    .select('id, job_id, appliance_id, reading_set, source, raw_text, data, created_at')
    .single();
  if (insertErr) throw new Error(insertErr.message);

  if (applianceId) {
    const prefix = `cp12.${applianceId}.fga.${input.readingSet}.`;
    const entries = Object.entries(input.data ?? {})
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => ({
        job_id: input.jobId,
        field_key: `${prefix}${key}`,
        value: value === null ? null : String(value),
      }));

    await persistJobFields(sb, input.jobId, entries, 'saveFgaReadings');
  }

  return inserted as FgaReadingRow;
}
