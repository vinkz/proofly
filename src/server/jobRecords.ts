'use server';

import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, Json } from '@/lib/database.types';
import { supabaseServerAction, supabaseServerReadOnly } from '@/lib/supabaseServer';
import type { JobRecordRow } from '@/types/job-records';

const JobId = z.string().uuid();
const InspectionContext = z.enum(['landlord', 'homeowner']).nullable();

const JOB_RECORDS_TABLE = 'job_records' as unknown as keyof Database['public']['Tables'];
const jobRecordColumns = 'job_id, record, created_at, updated_at';
type JsonRecord = { [key: string]: Json | undefined };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeRecord = (value: unknown): JsonRecord => (isPlainObject(value) ? (value as JsonRecord) : {});

const normalizePatch = (value: unknown): JsonRecord => {
  if (!isPlainObject(value)) {
    throw new Error('Invalid record patch');
  }
  return value as JsonRecord;
};

async function requireUser(options: { write?: boolean } = {}) {
  const sb = options.write ? await supabaseServerAction() : await supabaseServerReadOnly();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');
  return { sb, user };
}

async function fetchJobRecord(
  sb: SupabaseClient<Database>,
  jobId: string,
): Promise<JobRecordRow | null> {
  const { data, error } = await sb
    .from(JOB_RECORDS_TABLE)
    .select(jobRecordColumns)
    .eq('job_id', jobId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as unknown as JobRecordRow;
}

async function ensureJobRecordWithClient(
  sb: SupabaseClient<Database>,
  jobId: string,
): Promise<JobRecordRow> {
  const existing = await fetchJobRecord(sb, jobId);
  if (existing) return existing;

  const { data, error } = await sb
    .from(JOB_RECORDS_TABLE)
    .insert({ job_id: jobId, record: {} })
    .select(jobRecordColumns)
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as JobRecordRow;
}

export async function getJobRecord(jobId: string): Promise<JobRecordRow | null> {
  JobId.parse(jobId);
  const { sb } = await requireUser();
  return fetchJobRecord(sb, jobId);
}

export async function ensureJobRecord(jobId: string): Promise<JobRecordRow> {
  JobId.parse(jobId);
  const { sb } = await requireUser({ write: true });
  return ensureJobRecordWithClient(sb, jobId);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSONB patches are intentionally loose.
export async function updateJobRecord(jobId: string, patch: any): Promise<JobRecordRow> {
  JobId.parse(jobId);
  const normalizedPatch = normalizePatch(patch as unknown);
  const { sb } = await requireUser({ write: true });
  const current = await ensureJobRecordWithClient(sb, jobId);
  const nextRecord = { ...normalizeRecord(current.record), ...normalizedPatch };

  const { data, error } = await sb
    .from(JOB_RECORDS_TABLE)
    .update({ record: nextRecord })
    .eq('job_id', jobId)
    .select(jobRecordColumns)
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as JobRecordRow;
}

export async function setInspectionContext(
  jobId: string,
  context: 'landlord' | 'homeowner' | null,
): Promise<JobRecordRow> {
  const normalized = InspectionContext.parse(context);
  return updateJobRecord(jobId, { inspection_context: normalized });
}

export async function setLegalRequirement(jobId: string, value: boolean): Promise<JobRecordRow> {
  const normalized = z.boolean().parse(value);
  return updateJobRecord(jobId, { legal_requirement: normalized });
}
