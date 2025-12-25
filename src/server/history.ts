'use server';

import { z } from 'zod';

import type { Database } from '@/lib/database.types';
import { supabaseServerAction } from '@/lib/supabaseServer';

const JobId = z.string().uuid();
const JOBS_TABLE = 'jobs' as const;
const CP12_APPLIANCES_TABLE = 'cp12_appliances' as const;
const JOB_FIELDS_TABLE = 'job_fields' as const;

const KNOWN_MAKES = ['Worcester Bosch', 'Vaillant', 'Ideal', 'Baxi'];

const splitMakeModel = (value: string | null | undefined) => {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return { make: '', model: '' };
  const knownMake = KNOWN_MAKES.find((make) => trimmed.toLowerCase().startsWith(make.toLowerCase()));
  if (knownMake) {
    return { make: knownMake, model: trimmed.slice(knownMake.length).trim() };
  }
  return { make: trimmed, model: '' };
};

export type ApplianceHistoryDefaults = {
  appliance: {
    type: string;
    make: string;
    model: string;
    location: string;
    serial: string;
    flueType: string;
  };
  readings: {
    operatingPressure: string;
    heatInput: string;
    coReadingPpm: string;
    ventilationSatisfactory: string;
    flueCondition: string;
    gasTightnessTest: string;
    safetyRating: string;
    classificationCode: string;
  };
  source: {
    jobId: string;
    date: string | null;
  };
};

type JobFieldRow = Database['public']['Tables']['job_fields']['Row'];

const toText = (value: unknown) => (typeof value === 'string' ? value : '');

export async function getLatestApplianceDefaultsForJob(jobId: string): Promise<ApplianceHistoryDefaults | null> {
  JobId.parse(jobId);
  const sb = await supabaseServerAction();

  const { data: job, error: jobError } = await sb
    .from(JOBS_TABLE)
    .select('id, address, client_id, certificate_type')
    .eq('id', jobId)
    .maybeSingle();
  if (jobError) throw new Error(jobError.message);
  if (!job) return null;

  let jobQuery = sb
    .from(JOBS_TABLE)
    .select('id, created_at, completed_at, certificate_type, address, client_id')
    .neq('id', jobId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (job.address) {
    jobQuery = jobQuery.eq('address', job.address);
  } else if (job.client_id) {
    jobQuery = jobQuery.eq('client_id', job.client_id);
  } else {
    return null;
  }

  if (job.certificate_type) {
    jobQuery = jobQuery.eq('certificate_type', job.certificate_type);
  }

  const { data: previousJob, error: previousError } = await jobQuery.maybeSingle();
  if (previousError) throw new Error(previousError.message);
  if (!previousJob) return null;

  const { data: applianceRow, error: applianceError } = await sb
    .from(CP12_APPLIANCES_TABLE)
    .select(
      'appliance_type, location, make_model, operating_pressure, heat_input, flue_type, ventilation_satisfactory, flue_condition, gas_tightness_test, co_reading_ppm, safety_rating, classification_code',
    )
    .eq('job_id', previousJob.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (applianceError) throw new Error(applianceError.message);

  const { data: jobFields, error: fieldsError } = await sb
    .from(JOB_FIELDS_TABLE)
    .select('field_key, value')
    .eq('job_id', previousJob.id)
    .in('field_key', ['serial_number', 'boiler_make', 'boiler_model', 'location', 'flue_type']);
  if (fieldsError) throw new Error(fieldsError.message);

  const fieldMap = (jobFields ?? []).reduce<Record<string, string>>((acc, field) => {
    const key = (field as JobFieldRow).field_key as string;
    acc[key] = toText((field as JobFieldRow).value);
    return acc;
  }, {});

  const { make, model } = splitMakeModel(applianceRow?.make_model ?? '');
  const resolvedMake = fieldMap.boiler_make || make;
  const resolvedModel = fieldMap.boiler_model || model;

  return {
    appliance: {
      type: toText(applianceRow?.appliance_type),
      make: resolvedMake,
      model: resolvedModel,
      location: fieldMap.location || toText(applianceRow?.location),
      serial: fieldMap.serial_number || '',
      flueType: fieldMap.flue_type || toText(applianceRow?.flue_type),
    },
    readings: {
      operatingPressure: toText(applianceRow?.operating_pressure),
      heatInput: toText(applianceRow?.heat_input),
      coReadingPpm: toText(applianceRow?.co_reading_ppm),
      ventilationSatisfactory: toText(applianceRow?.ventilation_satisfactory),
      flueCondition: toText(applianceRow?.flue_condition),
      gasTightnessTest: toText(applianceRow?.gas_tightness_test),
      safetyRating: toText(applianceRow?.safety_rating),
      classificationCode: toText(applianceRow?.classification_code),
    },
    source: {
      jobId: previousJob.id,
      date: previousJob.completed_at ?? previousJob.created_at ?? null,
    },
  };
}
