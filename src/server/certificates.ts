'use server';
// Customers: jobs.client_id is the canonical link to public.clients; job_fields are kept for backwards compatibility only.
// Addresses: jobs.address_id -> job_addresses is the canonical property address; jobs.address/job_fields are legacy fallbacks.

import { revalidatePath } from 'next/cache';
import { Buffer } from 'node:buffer';
import { z } from 'zod';

import { cookies } from 'next/headers';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/lib/database.types';
import { supabaseServerReadOnly, supabaseServerServiceRole } from '@/lib/supabaseServer';
import type { CertificateType, PhotoCategory, Cp12Appliance } from '@/types/certificates';
import { CERTIFICATE_TYPES, PHOTO_CATEGORIES, CERTIFICATE_LABELS } from '@/types/certificates';
import { DEFAULT_JOB_TYPE } from '@/types/job-records';
import type { BoilerServicePhotoCategory } from '@/types/boiler-service';
import { BOILER_SERVICE_PHOTO_CATEGORIES, BOILER_SERVICE_REQUIRED_FOR_ISSUE } from '@/types/boiler-service';
import type { GasWarningNoticeFields } from '@/types/gas-warning-notice';
import { GAS_WARNING_REQUIRED_FOR_ISSUE } from '@/types/gas-warning-notice';
import type { GeneralWorksPhotoCategory } from '@/types/general-works';
import { GENERAL_WORKS_PHOTO_CATEGORIES, GENERAL_WORKS_REQUIRED_FIELDS } from '@/types/general-works';
import { renderGeneralWorksPdf } from '@/lib/pdf/general-works';
import { renderCp12CertificatePdf, type ApplianceInput, type Cp12FieldMap } from '@/server/pdf/renderCp12Certificate';
import {
  renderGasServicePdf,
  type ApplianceInput as GasServiceApplianceInput,
  type GasServiceFieldMap,
} from '@/server/pdf/renderGasServicePdf';
import { renderGasWarningNoticePdf } from '@/server/pdf/renderGasWarningNoticePdf';
import type { Customer } from '@/server/customer-service';
import { getCustomerById, upsertCustomerFromJobFields } from '@/server/customer-service';
import { formatJobAddress } from '@/lib/address';
import type { JobAddress } from '@/server/address-service';
import { upsertJobAddressForJob } from '@/server/address-service';

type JobInsertPayload = {
  certificateType: CertificateType;
  title?: string | null;
  clientName?: string | null;
  address?: string | null;
  scheduledFor?: string | null;
  clientId?: string | null;
};

type JobRow = Database['public']['Tables']['jobs']['Row'];
type JobContext = {
  job: Pick<JobRow, 'id' | 'user_id' | 'client_id' | 'client_name' | 'address' | 'scheduled_for' | 'title'>;
  customer: Customer | null;
  address: JobAddress | null;
};

const JOB_FIELDS_TABLE = 'job_fields' as unknown as keyof Database['public']['Tables'];
const CP12_APPLIANCES_TABLE = 'cp12_appliances' as unknown as keyof Database['public']['Tables'];
const JOB_PHOTOS_TABLE = 'job_photos' as unknown as keyof Database['public']['Tables'];
type JobFieldRow = { field_key: string; value: string | null };

const pickText = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return '';
};

async function loadJobContext(
  sb: SupabaseClient<Database>,
  jobId: string,
  label: string,
): Promise<JobContext> {
  const { data: job, error: jobErr } = await sb
    .from('jobs')
    .select('id, user_id, client_id, client_name, address, scheduled_for, title')
    .eq('id', jobId as JobRow['id'])
    .maybeSingle();
  if (jobErr || !job) throw new Error(jobErr?.message ?? `${label}: job not found`);
  const jobRow = job as unknown as JobContext['job'];
  const customer = jobRow.client_id
    ? await getCustomerById(jobRow.client_id, { sb, userId: jobRow.user_id ?? null, requireOwner: false })
    : null;
  const address = null; // address_id is legacy
  return { job: jobRow, customer, address };
}

function resolveJobCustomer(
  ctx: JobContext,
  fallback: { name?: string; address?: string; phone?: string; email?: string; organization?: string } = {},
) {
  return {
    name: pickText(ctx.customer?.name ?? null, ctx.job.client_name ?? null, fallback.name),
    address: pickText(ctx.customer?.address ?? null, fallback.address),
    phone: pickText(ctx.customer?.phone ?? null, fallback.phone),
    email: pickText(ctx.customer?.email ?? null, fallback.email),
    organization: pickText(ctx.customer?.organization ?? null, fallback.organization),
  };
}

function resolveJobPropertyAddress(
  ctx: JobContext,
  fallback: { line1?: string; line2?: string; town?: string; postcode?: string; legacy?: string } = {},
) {
  const line1 = pickText(ctx.address?.line1 ?? null, fallback.line1, ctx.job.address ?? null, fallback.legacy);
  const line2 = pickText(ctx.address?.line2 ?? null, fallback.line2);
  const town = pickText(ctx.address?.town ?? null, fallback.town);
  const postcode = pickText(ctx.address?.postcode ?? null, fallback.postcode);
  const summary = pickText(formatJobAddress(ctx.address), line1, ctx.job.address ?? null, fallback.legacy);
  return { line1, line2, town, postcode, summary };
}

function extractPropertyAddress(fields: Record<string, unknown>) {
  const line1 = pickText(
    typeof fields.property_address_line1 === 'string' ? fields.property_address_line1 : undefined,
    typeof fields.property_address === 'string' ? fields.property_address : undefined,
    typeof fields.address === 'string' ? fields.address : undefined,
  );
  const line2 = pickText(typeof fields.property_address_line2 === 'string' ? fields.property_address_line2 : undefined);
  const town = pickText(typeof fields.property_town === 'string' ? fields.property_town : undefined);
  const postcode = pickText(
    typeof fields.property_postcode === 'string' ? fields.property_postcode : undefined,
    typeof fields.postcode === 'string' ? fields.postcode : undefined,
  );
  return { line1, line2, town, postcode };
}

async function persistJobFields(
  sb: Awaited<ReturnType<typeof supabaseServerServiceRole>>,
  jobId: string,
  entries: { job_id: string; field_key: string; value: string | null }[],
  label: string,
) {
  if (!entries.length) return;
  const keys = entries.map((e) => e.field_key);
  console.log(`${label}: deleting existing job_fields`, { jobId, keys });
  const { error: delErr } = await sb.from(JOB_FIELDS_TABLE).delete().eq('job_id', jobId).in('field_key', keys);
  if (delErr) {
    console.error(`${label}: delete job_fields failed`, { jobId, error: delErr });
    throw new Error(delErr.message);
  }
  const insertPayload = entries as unknown as Database['public']['Tables']['jobs']['Insert'][];
  const { data, error: insErr } = await sb.from(JOB_FIELDS_TABLE).insert(insertPayload).select();
  console.log(`${label}: inserted job_fields`, { jobId, count: data?.length ?? 0, error: insErr });
  if (insErr) {
    throw new Error(insErr.message);
  }
}

async function getUserWithRetry(
  client: Awaited<ReturnType<typeof supabaseServerReadOnly>> | Awaited<ReturnType<typeof supabaseServerServiceRole>>,
  label: string,
  attempts = 3,
) {
  for (let i = 0; i < attempts; i++) {
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (!error || error.message !== 'Request rate limit reached') {
      return { user, error };
    }
    console.warn(`${label}: auth.getUser rate limited`, { attempt: i + 1, message: error.message });
    await new Promise((resolve) => setTimeout(resolve, 200 * (i + 1)));
  }
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  return { user, error };
}

const CreateJobSchema = z.object({
  certificateType: z.enum(CERTIFICATE_TYPES),
  title: z.string().optional(),
  clientName: z.string().optional(),
  address: z.string().optional(),
  scheduledFor: z.string().optional(),
  clientId: z.string().uuid().optional(),
});

export async function createJob(payload: JobInsertPayload) {
  const input = CreateJobSchema.parse(payload);
  const readClient = await supabaseServerReadOnly();
  const { user, error } = await getUserWithRetry(readClient, 'createJob');
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  const sb = await supabaseServerServiceRole();
  const linkedClient = input.clientId
    ? await getCustomerById(input.clientId, { sb, userId: user.id, requireOwner: true })
    : null;

  if (input.clientId && !linkedClient) {
    throw new Error('Client not found');
  }

  const resolvedClientName = input.clientName ?? linkedClient?.name ?? null;
  const resolvedAddress = input.address ?? linkedClient?.address ?? null;
  const insertPayload = {
    status: 'draft',
    title: input.title ?? `${CERTIFICATE_LABELS[input.certificateType]} draft`,
    client_id: linkedClient?.id ?? null,
    client_name: resolvedClientName,
    address: resolvedAddress,
    scheduled_for: input.scheduledFor ?? null,
    user_id: user.id,
    job_type: DEFAULT_JOB_TYPE,
  } as Record<string, unknown>;
  const { data, error: insertErr } = await sb
    .from('jobs')
    .insert(insertPayload as unknown as Database['public']['Tables']['jobs']['Insert'])
    .select('id')
    .single();

  if (insertErr || !data) {
    throw new Error(insertErr?.message ?? 'Unable to start certificate');
  }

  const jobRow = data as unknown as { id: string };

  if (resolvedAddress) {
    await upsertJobAddressForJob({
      jobId: jobRow.id,
      fields: { line1: resolvedAddress },
      sb,
      userId: user.id,
    });
  }

  if (resolvedClientName || resolvedAddress) {
    await upsertCustomerFromJobFields({
      jobId: jobRow.id,
      fields: {
        customer_name: resolvedClientName ?? undefined,
        property_address: resolvedAddress ?? undefined,
      },
      sb,
      userId: user.id,
    });
  }

  return { jobId: jobRow.id };
}

const AssignClientSchema = z.object({
  jobId: z.string().uuid(),
  clientId: z.string().uuid(),
});

export async function assignClientToJob(payload: z.infer<typeof AssignClientSchema>) {
  const input = AssignClientSchema.parse(payload);
  const sb = await supabaseServerServiceRole();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  const { data: job, error: jobErr } = await sb
    .from('jobs')
    .select('id, user_id, client_name, address')
    .eq('id', input.jobId as JobRow['id'])
    .maybeSingle();
  if (jobErr || !job) throw new Error(jobErr?.message ?? 'Job not found');
  if (job.user_id && job.user_id !== user.id) throw new Error('Unauthorized');

  const client = await getCustomerById(input.clientId, { sb, userId: user.id, requireOwner: true });
  if (!client) throw new Error('Client not found');

  const nextClientName = pickText(job.client_name ?? null, client.name);
  const nextAddress = pickText(job.address ?? null, client.address ?? null);

  const updatePayload = {
    client_id: client.id,
    client_name: nextClientName || null,
    address: nextAddress || null,
  } as Database['public']['Tables']['jobs']['Update'];

  const { error: updateErr } = await sb
    .from('jobs')
    .update(updatePayload)
    .eq('id', input.jobId as JobRow['id'])
    .eq('user_id', user.id);
  if (updateErr) throw new Error(updateErr.message);

  if (nextAddress && nextAddress !== job.address) {
    await upsertJobAddressForJob({
      jobId: input.jobId,
      fields: { line1: nextAddress },
      sb,
      userId: user.id,
    });
  }

  return { ok: true };
}

const SaveJobInfoSchema = z.object({
  jobId: z.string().uuid(),
  certificateType: z.enum(CERTIFICATE_TYPES),
  fields: z.record(z.string(), z.string().nullable().optional()),
});

const SaveJobFieldsSchema = z.object({
  jobId: z.string().uuid(),
  fields: z.record(z.string(), z.string().nullable().optional()),
});

export async function saveJobInfo(payload: z.infer<typeof SaveJobInfoSchema>) {
  const input = SaveJobInfoSchema.parse(payload);
  const sb = await supabaseServerServiceRole();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  const { jobId, fields } = input;
  const coreUpdates: Record<string, unknown> = {
    client_name: fields.customer_name ?? null,
    address: fields.address ?? null,
    title: fields.job_type ?? null,
    scheduled_for: fields.datetime ?? null,
  };

  await sb.from('jobs').update(coreUpdates).eq('id', jobId).eq('user_id', user.id);
  await upsertCustomerFromJobFields({ jobId, fields, sb, userId: user.id });
  const propertyAddress = extractPropertyAddress(fields);
  await upsertJobAddressForJob({ jobId, fields: propertyAddress, sb, userId: user.id });

  const fieldEntries = Object.entries(fields).map(([key, value]) => ({
    job_id: jobId,
    field_key: key,
    value: value ?? null,
  }));

  if (fieldEntries.length) {
    await persistJobFields(sb, jobId, fieldEntries, 'saveJobInfo');
  }

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

export async function saveJobFields(payload: z.infer<typeof SaveJobFieldsSchema>) {
  const input = SaveJobFieldsSchema.parse(payload);
  const sb = await supabaseServerServiceRole();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');
  console.log('saveJobFields called', { jobId: input.jobId, keys: Object.keys(input.fields) });
  const entries = Object.entries(input.fields).map(([key, value]) => ({
    job_id: input.jobId,
    field_key: key,
    value: value ?? null,
  }));
  await persistJobFields(sb, input.jobId, entries, 'saveJobFields');
  revalidatePath(`/jobs/${input.jobId}`);
  return { ok: true };
}

const PhotoSchema = z.object({
  jobId: z.string().uuid(),
  category: z.enum(PHOTO_CATEGORIES.map((p) => p.key) as [PhotoCategory, ...PhotoCategory[]]),
  file: z.instanceof(File),
});

export async function uploadJobPhoto(formData: FormData) {
  const file = formData.get('file');
  const jobId = formData.get('jobId');
  const category = formData.get('category');

  const parsed = PhotoSchema.safeParse({ jobId, category, file });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid upload payload');
  }

  const sb = await supabaseServerServiceRole();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  const { jobId: id, category: cat, file: uploadFile } = parsed.data;
  const arrayBuffer = await uploadFile.arrayBuffer();
  const fileExt = uploadFile.name.split('.').pop() ?? 'jpg';
  const path = `${user.id}/${id}/${cat}-${Date.now()}.${fileExt}`;

  const { error: uploadErr } = await sb.storage.from('job-photos').upload(path, arrayBuffer, {
    contentType: uploadFile.type,
    upsert: true,
  });
  if (uploadErr) throw new Error(uploadErr.message);

  const publicUrl = sb.storage.from('job-photos').getPublicUrl(path).data.publicUrl;

  const insertPayload = { job_id: id, category: cat, file_url: publicUrl, user_id: user.id } as Record<string, unknown>;
  const { error: insertErr } = await sb.from(JOB_PHOTOS_TABLE).insert(insertPayload);
  if (insertErr) throw new Error(insertErr.message);

  revalidatePath(`/jobs/${id}`);
  return { url: publicUrl };
}

export async function getCertificateWizardState(jobId: string) {
  const sb = await supabaseServerReadOnly();
  const { user, error } = await getUserWithRetry(sb, 'getCertificateWizardState');
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  const { data: job, error: jobErr } = await sb.from('jobs').select('*').eq('id', jobId).eq('user_id', user.id).maybeSingle();
  if (jobErr || !job) throw new Error(jobErr?.message ?? 'Job not found');
  const jobRow = job as unknown as JobRow;
  const client = jobRow.client_id
    ? await getCustomerById(jobRow.client_id, { sb, userId: user.id, requireOwner: false })
    : null;
  const jobAddress = resolveJobPropertyAddress({
    job: jobRow,
    customer: client,
    address: null,
  });

  const { data: fields, error: fieldsErr } = await sb.from(JOB_FIELDS_TABLE).select('field_key, value').eq('job_id', jobId);
  if (fieldsErr) throw new Error(fieldsErr.message);
  const fieldRows = (fields ?? []) as unknown as JobFieldRow[];
  const fieldRecord = Object.fromEntries(fieldRows.map((f) => [f.field_key, f.value ?? null]));

  const { data: profileRow, error: profileErr } = await sb
    .from('profiles')
    .select('company_name, default_engineer_name, default_engineer_id, gas_safe_number, full_name')
    .eq('id', user.id)
    .maybeSingle();
  if (profileErr && profileErr.code !== '42703') {
    throw new Error(profileErr.message);
  }

  const applyDefault = (key: string, value: string | null | undefined) => {
    if (!value) return;
    const existing = fieldRecord[key];
    if (typeof existing === 'string' && existing.trim()) return;
    fieldRecord[key] = value;
  };

  if (profileRow) {
    const engineerName = profileRow.default_engineer_name ?? profileRow.full_name ?? null;
    applyDefault('engineer_name', engineerName);
    applyDefault('company_name', profileRow.company_name ?? null);
    applyDefault('engineer_company', profileRow.company_name ?? null);
    applyDefault('gas_safe_number', profileRow.gas_safe_number ?? null);
    applyDefault('engineer_id_card_number', profileRow.default_engineer_id ?? null);
  }
  const photoNotes: Record<string, string> = {};
  Object.entries(fieldRecord).forEach(([key, value]) => {
    if (key.startsWith('photo_note_') && typeof value === 'string') {
      photoNotes[key.replace('photo_note_', '')] = value;
    }
  });

  const { data: photos, error: photosErr } = await sb
    .from(JOB_PHOTOS_TABLE)
    .select('category, file_url')
    .eq('job_id', jobId);
  if (photosErr) throw new Error(photosErr.message);
  const photoPreviews: Record<string, string> = {};
  const photoRows = (photos ?? []) as unknown as Array<{ category: string | null; file_url: string | null }>;
  photoRows.forEach((photo) => {
    if (photo.category && photo.file_url && !photoPreviews[photo.category]) {
      photoPreviews[photo.category] = photo.file_url;
    }
  });

  let appliances: Cp12Appliance[] = [];
  const appResp = await sb.from(CP12_APPLIANCES_TABLE).select('*').eq('job_id', jobId);
  if (appResp.error) {
    if (appResp.error.code !== '42P01') throw new Error(appResp.error.message);
  } else if (appResp.data) {
    appliances = appResp.data as unknown as Cp12Appliance[];
  }

  return {
    job: jobRow,
    client,
    jobAddress,
    fields: fieldRecord,
    photoNotes,
    photoPreviews,
    appliances,
  };
}

const UpdateFieldSchema = z.object({
  jobId: z.string().uuid(),
  key: z.string(),
  value: z.string().optional().nullable(),
});

export async function updateField(payload: z.infer<typeof UpdateFieldSchema>) {
  const input = UpdateFieldSchema.parse(payload);
  const sb = await supabaseServerServiceRole();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  await sb
    .from(JOB_FIELDS_TABLE)
    .delete()
    .eq('job_id', input.jobId)
    .eq('field_key', input.key);

  const insertPayload = {
    job_id: input.jobId,
    field_key: input.key,
    value: input.value ?? null,
  } as unknown as Database['public']['Tables']['jobs']['Insert'];
  const { error: insErr } = await sb.from(JOB_FIELDS_TABLE).insert(insertPayload);
  if (insErr) {
    console.error('updateField insert failed', { jobId: input.jobId, key: input.key, error: insErr });
    throw new Error(insErr.message);
  }

  revalidatePath(`/jobs/${input.jobId}`);
  return { ok: true };
}

const optionalText = z.string().optional().default('');
const optionalLooseText = z.string().optional();
const optionalLooseBool = z.boolean().optional();

const BoilerServiceJobInfoSchema = z.object({
  jobId: z.string().uuid(),
  data: z.object({
    customer_name: optionalText,
    property_address: optionalText,
    postcode: optionalText,
    service_date: optionalText,
    engineer_name: optionalText,
    gas_safe_number: optionalText,
    company_name: optionalText,
    company_address: optionalText,
  }),
});

const BoilerServiceDetailsSchema = z.object({
  jobId: z.string().uuid(),
  data: z.object({
    boiler_make: optionalText,
    boiler_model: optionalText,
    boiler_type: optionalText,
    boiler_location: optionalText,
    serial_number: optionalText,
    gas_type: optionalText,
    mount_type: optionalText,
    flue_type: optionalText,
  }),
});

const BoilerServiceChecksSchema = z.object({
  jobId: z.string().uuid(),
  data: z.object({
    service_visual_inspection: optionalText,
    service_burner_cleaned: optionalText,
    service_heat_exchanger_cleaned: optionalText,
    service_condensate_trap_checked: optionalText,
    service_seals_checked: optionalText,
    service_filters_cleaned: optionalText,
    service_flue_checked: optionalText,
    service_ventilation_checked: optionalText,
    service_controls_checked: optionalText,
    service_leaks_checked: optionalText,
    operating_pressure_mbar: optionalText,
    inlet_pressure_mbar: optionalText,
    co_ppm: optionalText,
    co2_percent: optionalText,
    flue_gas_temp_c: optionalText,
    system_pressure_bar: optionalText,
    service_summary: optionalText,
    recommendations: optionalText,
    defects_found: optionalText,
    defects_details: optionalText,
    parts_used: optionalText,
    next_service_due: optionalText,
  }),
});

const GasWarningJobInfoSchema = z.object({
  jobId: z.string().uuid(),
  data: z.object({
    property_address: optionalLooseText,
    postcode: optionalLooseText,
    customer_name: optionalLooseText,
    customer_contact: optionalLooseText,
  }),
});

const GasWarningDetailsSchema = z.object({
  jobId: z.string().uuid(),
  data: z.object({
    appliance_location: optionalLooseText,
    appliance_type: optionalLooseText,
    make_model: optionalLooseText,
    gas_supply_isolated: optionalLooseBool,
    appliance_capped_off: optionalLooseBool,
    customer_refused_isolation: optionalLooseBool,
    classification: optionalLooseText,
    classification_code: optionalLooseText,
    unsafe_situation_description: optionalLooseText,
    underlying_cause: optionalLooseText,
    actions_taken: optionalLooseText,
    emergency_services_contacted: optionalLooseBool,
    emergency_reference: optionalLooseText,
    danger_do_not_use_label_fitted: optionalLooseBool,
    meter_or_appliance_tagged: optionalLooseBool,
    customer_informed: optionalLooseBool,
    customer_understands_risks: optionalLooseBool,
    customer_signed_at: optionalLooseText,
    engineer_name: optionalLooseText,
    engineer_company: optionalLooseText,
    gas_safe_number: optionalLooseText,
    engineer_id_card_number: optionalLooseText,
    issued_at: optionalLooseText,
    record_id: optionalLooseText,
  }),
});

const BoilerServicePhotoSchema = z.object({
  jobId: z.string().uuid(),
  category: z.enum(BOILER_SERVICE_PHOTO_CATEGORIES as unknown as [BoilerServicePhotoCategory, ...BoilerServicePhotoCategory[]]),
  file: z.instanceof(File),
});

const GeneralWorksInfoSchema = z.object({
  jobId: z.string().uuid(),
  data: z.record(z.string(), z.string().optional().nullable()),
});

const GeneralWorksPhotoSchema = z.object({
  jobId: z.string().uuid(),
  category: z.enum(GENERAL_WORKS_PHOTO_CATEGORIES as unknown as [GeneralWorksPhotoCategory, ...GeneralWorksPhotoCategory[]]),
  file: z.instanceof(File),
});

export async function saveBoilerServiceJobInfo(payload: z.infer<typeof BoilerServiceJobInfoSchema>) {
  const input = BoilerServiceJobInfoSchema.parse(payload);
  const sb = await supabaseServerServiceRole();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  const { jobId, data } = input;
  const certificateType: CertificateType = 'gas_service';
  const { error: updateErr } = await sb
    .from('jobs')
    .update({
      client_name: data.customer_name,
      address: data.property_address,
      scheduled_for: data.service_date || null,
      title: data.customer_name ? `Boiler Service for ${data.customer_name}` : 'Boiler Service draft',
    })
    .eq('id', jobId)
    .eq('user_id', user.id);
  if (updateErr) throw new Error(updateErr.message);
  await upsertCustomerFromJobFields({ jobId, fields: data, sb, userId: user.id });
  await upsertJobAddressForJob({
    jobId,
    fields: { line1: data.property_address, postcode: data.postcode },
    sb,
    userId: user.id,
  });

  const entries = Object.entries(data).map(([key, value]) => ({
    job_id: jobId,
    field_key: key,
    value: value ?? null,
  }));
  await persistJobFields(sb, jobId, entries, 'saveBoilerServiceJobInfo');
  revalidatePath(`/wizard/create/${certificateType}?jobId=${jobId}`);
  return { ok: true };
}

export async function saveBoilerServiceDetails(payload: z.infer<typeof BoilerServiceDetailsSchema>) {
  const input = BoilerServiceDetailsSchema.parse(payload);
  const sb = await supabaseServerServiceRole();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  const certificateType: CertificateType = 'gas_service';
  const entries = Object.entries(input.data).map(([key, value]) => ({
    job_id: input.jobId,
    field_key: key,
    value: value ?? null,
  }));
  await persistJobFields(sb, input.jobId, entries, 'saveBoilerServiceDetails');
  revalidatePath(`/wizard/create/${certificateType}?jobId=${input.jobId}`);
  return { ok: true };
}

export async function saveBoilerServiceChecks(payload: z.infer<typeof BoilerServiceChecksSchema>) {
  const input = BoilerServiceChecksSchema.parse(payload);
  const sb = await supabaseServerServiceRole();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  const certificateType: CertificateType = 'gas_service';
  const entries = Object.entries(input.data).map(([key, value]) => ({
    job_id: input.jobId,
    field_key: key,
    value: value ?? null,
  }));
  await persistJobFields(sb, input.jobId, entries, 'saveBoilerServiceChecks');
  revalidatePath(`/wizard/create/${certificateType}?jobId=${input.jobId}`);
  return { ok: true };
}

export async function saveGasWarningJobInfo(payload: z.infer<typeof GasWarningJobInfoSchema>) {
  const input = GasWarningJobInfoSchema.parse(payload);
  const sb = await supabaseServerServiceRole();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  const { jobId, data } = input;
  const certificateType: CertificateType = 'gas_warning_notice';
  const updatePayload = {
    client_name: data.customer_name ?? null,
    address: data.property_address ?? null,
    title: data.customer_name ? `Gas Warning Notice for ${data.customer_name}` : 'Gas Warning Notice draft',
  } as Record<string, unknown>;
  await sb.from('jobs').update(updatePayload).eq('id', jobId).eq('user_id', user.id);
  await upsertCustomerFromJobFields({ jobId, fields: data, sb, userId: user.id });
  await upsertJobAddressForJob({
    jobId,
    fields: { line1: data.property_address ?? undefined, postcode: data.postcode ?? undefined },
    sb,
    userId: user.id,
  });

  const entries = Object.entries(data)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ({
      job_id: jobId,
      field_key: key,
      value: typeof value === 'boolean' ? String(value) : value ?? null,
    }));
  await persistJobFields(sb, jobId, entries, 'saveGasWarningJobInfo');
  revalidatePath(`/wizard/create/${certificateType}?jobId=${jobId}`);
  return { ok: true };
}

export async function saveGasWarningDetails(payload: z.infer<typeof GasWarningDetailsSchema>) {
  const input = GasWarningDetailsSchema.parse(payload);
  const sb = await supabaseServerServiceRole();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  const certificateType: CertificateType = 'gas_warning_notice';
  const updates: Record<string, unknown> = {
  };
  if (input.data.issued_at) {
    updates.scheduled_for = input.data.issued_at;
  }
  await sb.from('jobs').update(updates).eq('id', input.jobId).eq('user_id', user.id);

  const entries = Object.entries(input.data)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ({
      job_id: input.jobId,
      field_key: key,
      value: typeof value === 'boolean' ? String(value) : value ?? null,
    }));
  await persistJobFields(sb, input.jobId, entries, 'saveGasWarningDetails');
  revalidatePath(`/wizard/create/${certificateType}?jobId=${input.jobId}`);
  return { ok: true };
}

export async function uploadBoilerServicePhoto(formData: FormData) {
  const payload = {
    jobId: formData.get('jobId'),
    category: formData.get('category'),
    file: formData.get('file'),
  };
  const parsed = BoilerServicePhotoSchema.safeParse(payload);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid upload payload');

  const { jobId, category, file } = parsed.data;
  const sb = await supabaseServerServiceRole();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  const arrayBuffer = await file.arrayBuffer();
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${user.id}/${jobId}/${category}-${Date.now()}.${ext}`;

  const { error: uploadErr } = await sb.storage
    .from('job-photos')
    .upload(path, arrayBuffer, { contentType: file.type || 'image/jpeg', upsert: true });
  if (uploadErr) throw new Error(uploadErr.message);

  const publicUrl = sb.storage.from('job-photos').getPublicUrl(path).data.publicUrl;

  const insertPayload = { job_id: jobId, category, file_url: publicUrl, user_id: user.id } as Record<string, unknown>;
  const { error: insertErr } = await sb.from(JOB_PHOTOS_TABLE).insert(insertPayload);
  if (insertErr) throw new Error(insertErr.message);

  revalidatePath(`/wizard/create/gas_service?jobId=${jobId}`);
  return { url: publicUrl };
}

export async function saveGeneralWorksInfo(payload: z.infer<typeof GeneralWorksInfoSchema>) {
  const input = GeneralWorksInfoSchema.parse(payload);
  const sb = await supabaseServerServiceRole();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  const { jobId, data } = input;
  const updates: Record<string, unknown> = {
    address: data.property_address ?? null,
    client_name: data.customer_name ?? null,
    scheduled_for: data.work_date ?? null,
    title: data.work_summary ? `General Works - ${data.work_summary}` : 'General Works draft',
  };
  await sb.from('jobs').update(updates).eq('id', jobId).eq('user_id', user.id);
  await upsertCustomerFromJobFields({ jobId, fields: data, sb, userId: user.id });
  await upsertJobAddressForJob({
    jobId,
    fields: { line1: data.property_address ?? undefined, postcode: data.postcode ?? undefined },
    sb,
    userId: user.id,
  });

  const entries = Object.entries(data).map(([key, value]) => ({
    job_id: jobId,
    field_key: key,
    value: value ?? null,
  }));
  if (entries.length) {
    await persistJobFields(sb, jobId, entries, 'saveGeneralWorksInfo');
  }
  revalidatePath(`/wizard/create/general_works?jobId=${jobId}`);
  return { ok: true };
}

export async function uploadGeneralWorksPhoto(formData: FormData) {
  const payload = {
    jobId: formData.get('jobId'),
    category: formData.get('category'),
    file: formData.get('file'),
  };
  const parsed = GeneralWorksPhotoSchema.safeParse(payload);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid upload payload');

  const { jobId, category, file } = parsed.data;
  const sb = await supabaseServerServiceRole();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  const arrayBuffer = await file.arrayBuffer();
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${user.id}/${jobId}/${category}-${Date.now()}.${ext}`;

  const { error: uploadErr } = await sb.storage
    .from('job-photos')
    .upload(path, arrayBuffer, { contentType: file.type || 'image/jpeg', upsert: true });
  if (uploadErr) throw new Error(uploadErr.message);

  const publicUrl = sb.storage.from('job-photos').getPublicUrl(path).data.publicUrl;

  const insertPayload = { job_id: jobId, category, file_url: publicUrl, user_id: user.id } as Record<string, unknown>;
  const { error: insertErr } = await sb.from(JOB_PHOTOS_TABLE).insert(insertPayload);
  if (insertErr) throw new Error(insertErr.message);

  revalidatePath(`/wizard/create/general_works?jobId=${jobId}`);
  return { url: publicUrl };
}

const Cp12JobSchema = z.object({
  jobId: z.string().uuid(),
  data: z.object({
    customer_name: optionalText,
    property_address: optionalText,
    postcode: optionalText,
    inspection_date: optionalText,
    landlord_name: optionalText,
    landlord_address: optionalText,
    engineer_name: optionalText,
    gas_safe_number: optionalText,
    reg_26_9_confirmed: z.boolean().optional().default(false),
    company_name: optionalText,
  }),
});

export async function saveCp12JobInfo(payload: z.infer<typeof Cp12JobSchema>) {
  const input = Cp12JobSchema.parse(payload);
  const sb = await supabaseServerServiceRole();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  const { jobId, data } = input;
  console.log('saveCp12JobInfo called', { jobId });
  await sb
    .from('jobs')
    .update({
      client_name: data.customer_name,
      address: data.property_address,
      scheduled_for: data.inspection_date,
      title: `CP12 for ${data.customer_name}`,
    })
    .eq('id', jobId)
    .eq('user_id', user.id);
  await upsertCustomerFromJobFields({ jobId, fields: data, sb, userId: user.id });
  await upsertJobAddressForJob({
    jobId,
    fields: { line1: data.property_address, postcode: data.postcode },
    sb,
    userId: user.id,
  });

  const entries = Object.entries(data).map(([key, value]) => ({
    job_id: jobId,
    field_key: key,
    value: typeof value === 'boolean' ? String(value) : value,
  }));
  await persistJobFields(sb, jobId, entries, 'saveCp12JobInfo');
  revalidatePath(`/wizard/create/cp12?jobId=${jobId}`);
  return { ok: true };
}

const Cp12ApplianceSchema = z.object({
  jobId: z.string().uuid(),
  appliances: z
    .array(
    z.object({
      id: z.string().uuid().optional(),
      appliance_type: optionalText,
      location: optionalText,
      make_model: optionalText,
      operating_pressure: optionalText,
      heat_input: optionalText,
      flue_type: optionalText,
      ventilation_provision: optionalText,
      ventilation_satisfactory: optionalText,
      flue_condition: optionalText,
      stability_test: optionalText,
      gas_tightness_test: optionalText,
      co_reading_ppm: optionalText,
      safety_rating: optionalText,
      classification_code: optionalText,
    }),
  )
    .min(0),
  defects: z.object({
    defect_description: optionalText,
    remedial_action: optionalText,
    warning_notice_issued: optionalText,
  }),
});

export async function saveCp12Appliances(payload: z.infer<typeof Cp12ApplianceSchema>) {
  const input = Cp12ApplianceSchema.parse(payload);
  const sb = await supabaseServerServiceRole();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  console.log('saveCp12Appliances called', { jobId: input.jobId, appliances: input.appliances.length });
  await sb.from(CP12_APPLIANCES_TABLE).delete().eq('job_id', input.jobId);

  if (input.appliances.length) {
    const rows = input.appliances.map((appliance) => ({
      job_id: input.jobId,
      user_id: user.id,
      ...appliance,
    }));
    const insertPayload = rows as unknown as Database['public']['Tables']['jobs']['Insert'][];
    const { data: insData, error: insertErr } = await sb.from(CP12_APPLIANCES_TABLE).insert(insertPayload).select();
    console.log('saveCp12Appliances insert', { jobId: input.jobId, count: insData?.length ?? 0, error: insertErr });
    if (insertErr) throw new Error(insertErr.message);
  }

  const defectEntries = Object.entries(input.defects).map(([key, value]) => ({
    job_id: input.jobId,
    field_key: key,
    value: value ?? null,
  }));
  if (defectEntries.length) {
    await persistJobFields(sb, input.jobId, defectEntries, 'saveCp12Appliances defects');
  }

  revalidatePath(`/wizard/create/cp12?jobId=${input.jobId}`);
  return { ok: true };
}

const CP12_REQUIRED_FIELDS = [
  'property_address',
  'inspection_date',
  'landlord_name',
  'landlord_address',
  'engineer_name',
  'gas_safe_number',
];

const hasValue = (val: unknown) => typeof val === 'string' && val.trim().length > 0;
const booleanFromField = (val: unknown) => val === true || val === 'true' || val === 'YES' || val === 'yes';

function validateGeneralWorksForIssue(fieldMap: Record<string, unknown>) {
  const errors: string[] = [];
  GENERAL_WORKS_REQUIRED_FIELDS.forEach((key) => {
    if (!hasValue(fieldMap[key])) errors.push(`${key.replace(/_/g, ' ')} is required`);
  });
  const defects = booleanFromField(fieldMap.defects_found);
  if (defects && !hasValue(fieldMap.defects_details)) {
    errors.push('Defect details required when defects are marked');
  }
  return errors;
}

function validateBoilerServiceForIssue(fieldMap: Record<string, unknown>) {
  const errors: string[] = [];
  BOILER_SERVICE_REQUIRED_FOR_ISSUE.forEach((key) => {
    if (!hasValue(fieldMap[key])) errors.push(`${key.replace(/_/g, ' ')} is required`);
  });

  const defects = booleanFromField(fieldMap.defects_found);
  if (defects && !hasValue(fieldMap.defects_details)) {
    errors.push('Defects details are required when defects are found');
  }

  return errors;
}

function validateGasWarningNoticeForIssue(fields: GasWarningNoticeFields) {
  const errors: string[] = [];
  GAS_WARNING_REQUIRED_FOR_ISSUE.forEach((key) => {
    if (key === 'customer_informed') {
      if (!booleanFromField(fields.customer_informed)) {
        errors.push('Customer must be informed before issuing');
      }
      return;
    }
    const value = (fields as Record<string, unknown>)[key];
    if (!hasValue(value)) errors.push(`${key.replace(/_/g, ' ')} is required`);
  });

  const classification = String(fields.classification ?? '').trim();
  if (classification === 'IMMEDIATELY_DANGEROUS') {
    if (!booleanFromField(fields.danger_do_not_use_label_fitted)) {
      errors.push('Danger: Do Not Use label must be fitted for Immediately Dangerous');
    }
    if (!booleanFromField(fields.gas_supply_isolated) && !booleanFromField(fields.customer_refused_isolation)) {
      errors.push('Customer refusal is required when gas supply is not isolated for Immediately Dangerous');
    }
  }

  return errors;
}

// CP12 validation per docs/specs/cp12.md
function validateCp12ForIssue(fieldMap: Record<string, unknown>, appliances: Cp12Appliance[]) {
  const errors: string[] = [];
  CP12_REQUIRED_FIELDS.forEach((key) => {
    if (!hasValue(fieldMap[key])) errors.push(`${key.replace(/_/g, ' ')} is required`);
  });

  if (!booleanFromField(fieldMap.reg_26_9_confirmed)) {
    errors.push('Regulation 26(9) confirmation is required');
  }

  const applianceRows = (appliances ?? []).filter(
    (app) => hasValue(app?.appliance_type) || hasValue(app?.location),
  );
  if (!applianceRows.length) {
    errors.push('At least one appliance with location and description is required');
  } else if (applianceRows.some((app) => !hasValue(app?.location) || !hasValue(app?.appliance_type))) {
    errors.push('Each appliance must include location and description');
  }
  applianceRows.forEach((app) => {
    if (hasValue(app.classification_code) && (app.safety_rating ?? '').toLowerCase() === 'safe') {
      errors.push('Classification code should only be set when safety rating is not safe');
    }
  });

  const defectsPresent = hasValue(fieldMap.defect_description) || hasValue(fieldMap.remedial_action);
  if (defectsPresent && (!hasValue(fieldMap.defect_description) || !hasValue(fieldMap.remedial_action))) {
    errors.push('Defects require both description and remedial action');
  }

  if (!hasValue(fieldMap.engineer_signature)) errors.push('Engineer signature is required');
  if (!hasValue(fieldMap.customer_signature)) errors.push('Customer signature is required');

  return errors;
}

type Cp12RenderInput = {
  fieldMap: Record<string, unknown>;
  appliances: Cp12Appliance[];
  issuedAt: string;
};

export async function renderCp12Pdf({ fieldMap, appliances, issuedAt }: Cp12RenderInput) {
  // Layout intentionally mirrors the spec in docs/specs/cp12.md
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const stroke = {
    borderColor: rgb(0.82, 0.85, 0.88),
    borderWidth: 1,
  };
  const noFill = { color: rgb(1, 1, 1), opacity: 0 };

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 34;

  const formatText = (val: unknown, fallback = '—') => {
    if (typeof val === 'string' && val.trim()) return val.trim();
    return fallback;
  };

  const createPage = () => pdfDoc.addPage([pageWidth, pageHeight]);
  let page = createPage();
  let y = pageHeight - margin;

  const drawText = (text: string, size: number, isBold = false) => {
    page.drawText(text, { x: margin, y, size, font: isBold ? bold : font });
    y -= size + 6;
  };

  const drawFieldBox = (label: string, value: string, boxWidth: number, boxHeight = 26, guideLines = 0) => {
    page.drawText(label, { x: margin, y, size: 9, font: bold });
    y -= boxHeight;
    page.drawRectangle({ x: margin, y, width: boxWidth, height: boxHeight, ...stroke, ...noFill });
    page.drawText(value, { x: margin + 6, y: y + 8, size: 10, font });
    if (!value) {
      for (let i = 1; i <= guideLines; i++) {
        const lineY = y + (boxHeight / (guideLines + 1)) * i;
        page.drawLine({
          start: { x: margin + 6, y: lineY },
          end: { x: margin + boxWidth - 6, y: lineY },
          thickness: 0.5,
          color: rgb(0.82, 0.85, 0.88),
        });
      }
    }
    y -= 12;
  };

  const ensureSpace = (minY: number, onBreak?: () => void) => {
    if (y <= minY) {
      page = createPage();
      y = pageHeight - margin;
      drawText('Gas Safety Record (CP12) — Continued', 12, true);
      if (onBreak) onBreak();
    }
  };

  drawText('Gas Safety Record (CP12)', 18, true);
  drawText(`Issued at: ${new Date(issuedAt).toLocaleString()}`, 10);

  drawText('Property details', 12, true);
  drawFieldBox('Property address', formatText(fieldMap.property_address), pageWidth - margin * 2);
  drawFieldBox('Postcode', formatText(fieldMap.postcode), 200);
  drawFieldBox('Inspection date', formatText(fieldMap.inspection_date), 200);

  ensureSpace(520);
  drawText('Landlord / Agent', 12, true);
  drawFieldBox('Landlord name', formatText(fieldMap.landlord_name), pageWidth - margin * 2);
  drawFieldBox('Landlord address', formatText(fieldMap.landlord_address), pageWidth - margin * 2);

  ensureSpace(420);
  drawText('Engineer', 12, true);
  drawFieldBox('Engineer name', formatText(fieldMap.engineer_name), pageWidth - margin * 2);
  drawFieldBox('Gas Safe number', formatText(fieldMap.gas_safe_number), 220);
  drawFieldBox('Company', formatText(fieldMap.company_name), pageWidth - margin * 2);

  ensureSpace(320);
  const tableHeaders = ['#', 'Location', 'Description', 'Operating pressure', 'Flue condition', 'Safety rating'];
  const colWidths = [20, 120, 130, 110, 100, 90];
  const drawApplianceHeader = () => {
    const headerY = y;
    let x = margin;
    tableHeaders.forEach((header, idx) => {
      page.drawRectangle({ x, y: headerY - 14, width: colWidths[idx], height: 24, ...stroke, ...noFill });
      page.drawText(header, { x: x + 4, y: headerY - 6, size: 9, font: bold });
      x += colWidths[idx];
    });
    y = headerY - 24;
  };
  drawText('Appliances / Flues', 12, true);
  drawApplianceHeader();

  appliances.forEach((app, index) => {
    ensureSpace(180, drawApplianceHeader);
    const appExtras = app as Cp12Appliance & { checked_date?: string; description?: string };
    const checkedDate = formatText(appExtras.checked_date ?? fieldMap.inspection_date ?? '', '');
    const rowValues = [
      `${index + 1}`,
      formatText(app.location),
      formatText(app.appliance_type ?? appExtras.description),
      formatText(app.operating_pressure),
      formatText(app.flue_condition || app.ventilation_provision),
      formatText(app.safety_rating),
    ];
    const rowY = y - 18;
    let x = margin;
    rowValues.forEach((value, idx) => {
      page.drawRectangle({ x, y: rowY, width: colWidths[idx], height: 24, ...stroke, ...noFill });
      page.drawText(value || '', { x: x + 4, y: rowY + 8, size: 9, font });
      x += colWidths[idx];
    });
    if (checkedDate) {
      page.drawText(`Checked: ${checkedDate}`, { x: margin + 4, y: rowY - 10, size: 8, font });
    }
    y = rowY - 18;
  });

  ensureSpace(140);
  drawText('Defects & remedial actions', 12, true);
  drawFieldBox('Defect description', formatText(fieldMap.defect_description), pageWidth - margin * 2, 44, 3);
  drawFieldBox('Remedial action', formatText(fieldMap.remedial_action), pageWidth - margin * 2, 44, 3);
  drawFieldBox('Warning notice issued', formatText(fieldMap.warning_notice_issued), 200);

  ensureSpace(90);
  drawText('Regulation 26(9) confirmation', 12, true);
  const regLine = booleanFromField(fieldMap.reg_26_9_confirmed) ? 'Confirmed' : 'Not confirmed';
  drawFieldBox('26(9) compliance', regLine, 220);

  ensureSpace(60);
  drawText('Signatures', 12, true);
  drawFieldBox('Engineer signature', formatText(fieldMap.engineer_signature, 'On file'), pageWidth / 2 - margin);
  drawFieldBox('Customer signature', formatText(fieldMap.customer_signature, 'On file'), pageWidth / 2 - margin);

  return pdfDoc.save();
}

const SignatureSchema = z.object({
  jobId: z.string().uuid(),
  role: z.enum(['engineer', 'customer']),
  file: z.instanceof(File),
});

export async function uploadSignature(formData: FormData) {
  const payload = {
    jobId: formData.get('jobId'),
    role: formData.get('role'),
    file: formData.get('file'),
  };
  const parsed = SignatureSchema.safeParse(payload);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid signature payload');

  const { jobId, role, file } = parsed.data;
  const sb = await supabaseServerServiceRole();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  const arrayBuffer = await file.arrayBuffer();
  const ext = file.name.split('.').pop() ?? 'png';
  const path = `signatures/${user.id}/${jobId}-${role}-${Date.now()}.${ext}`;
  const upload = await sb.storage.from('signatures').upload(path, arrayBuffer, {
    contentType: file.type || 'image/png',
    upsert: true,
  });
  if (upload.error) throw new Error(upload.error.message);
  const url = sb.storage.from('signatures').getPublicUrl(path).data.publicUrl;

  await sb
    .from(JOB_FIELDS_TABLE)
    .upsert(
      { job_id: jobId, field_key: `${role}_signature`, value: url } as Record<string, unknown>,
      { onConflict: 'job_id,field_key' },
    );
  revalidatePath(`/jobs/${jobId}`);
  return { url };
}

const GenerateGeneralWorksPdfSchema = z.object({
  jobId: z.string().uuid(),
  previewOnly: z.boolean().optional().default(false),
});

const GenerateGasServicePdfSchema = z.object({
  jobId: z.string().uuid(),
  previewOnly: z.boolean().optional().default(false),
});
export async function generateGeneralWorksPdf(payload: z.infer<typeof GenerateGeneralWorksPdfSchema>) {
  const input = GenerateGeneralWorksPdfSchema.parse(payload);
  const previewOnly = input.previewOnly ?? false;
  console.log('GW: starting PDF generation', { jobId: input.jobId });
  console.log('GW: service role key present', Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY));
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
  const {
    data: authUser,
    error: authErr,
  } = await supabase.auth.getUser();
  console.log('GW: auth user', authUser, authErr);

  const jobContext = await loadJobContext(supabase, input.jobId, 'generateGeneralWorksPdf');
  const jobOwnerId = jobContext.job.user_id ?? null;

  const { data: fields, error: fieldsErr } = await supabase
    .from(JOB_FIELDS_TABLE)
    .select('field_key, value')
    .eq('job_id', input.jobId);
  if (fieldsErr) throw new Error(fieldsErr.message);
  const fieldRows = (fields ?? []) as unknown as JobFieldRow[];
  const fieldMap = Object.fromEntries(fieldRows.map((f) => [f.field_key, f.value ?? null]));
  const customer = resolveJobCustomer(jobContext, {
    name: typeof fieldMap.customer_name === 'string' ? fieldMap.customer_name : undefined,
    address: typeof fieldMap.customer_address === 'string' ? fieldMap.customer_address : undefined,
    phone: typeof fieldMap.customer_phone === 'string' ? fieldMap.customer_phone : undefined,
    email: typeof fieldMap.customer_email === 'string' ? fieldMap.customer_email : undefined,
  });
  const propertyAddress = resolveJobPropertyAddress(jobContext, {
    line1: typeof fieldMap.property_address === 'string' ? fieldMap.property_address : undefined,
    line2: typeof fieldMap.property_address_line2 === 'string' ? fieldMap.property_address_line2 : undefined,
    town: typeof fieldMap.property_town === 'string' ? fieldMap.property_town : undefined,
    postcode: typeof fieldMap.postcode === 'string' ? fieldMap.postcode : undefined,
    legacy: typeof fieldMap.address === 'string' ? fieldMap.address : undefined,
  });
  const mergedFieldMap = {
    ...fieldMap,
    customer_name: customer.name || fieldMap.customer_name,
    property_address: propertyAddress.summary || fieldMap.property_address,
    postcode: propertyAddress.postcode || fieldMap.postcode,
    customer_phone: customer.phone || fieldMap.customer_phone,
    customer_email: customer.email || fieldMap.customer_email,
  };

  const { data: photos, error: photosErr } = await supabase
    .from(JOB_PHOTOS_TABLE)
    .select('category, file_url')
    .eq('job_id', input.jobId);
  if (photosErr) throw new Error(photosErr.message);

  const issuedAt = new Date();
  const validationErrors = previewOnly ? [] : validateGeneralWorksForIssue(mergedFieldMap);
  if (validationErrors.length) {
    throw new Error(`General Works validation failed: ${validationErrors.join('; ')}`);
  }

  const photoRows = (photos ?? []) as unknown as Array<{ category?: string | null; file_url?: string | null }>;
  const pdfBytes = await renderGeneralWorksPdf({
    fieldMap: mergedFieldMap,
    photos: photoRows.filter((p) => p.category && p.file_url) as { category: string; file_url: string }[],
    issuedAt: issuedAt.toISOString(),
    previewMode: previewOnly,
  });

  const pathBase = previewOnly ? 'general-works/previews' : 'general-works';
  const path = `${pathBase}/${jobOwnerId ?? 'unknown-user'}/${input.jobId}-${previewOnly ? 'preview' : Date.now()}.pdf`;
  const upload = await supabase.storage
    .from('certificates')
    .upload(path, Buffer.from(pdfBytes), { contentType: 'application/pdf', upsert: true });
  if (upload.error || !upload.data?.path) {
    throw new Error(upload.error?.message ?? 'Certificate PDF upload failed');
  }

  if (previewOnly) {
    const { data: signed, error: signedErr } = await supabase.storage.from('certificates').createSignedUrl(path, 60 * 10);
    if (signedErr || !signed?.signedUrl) {
      throw new Error(signedErr?.message ?? 'Unable to create signed URL for certificate');
    }
    console.log('GENERAL WORKS PDF preview generated', { jobId: input.jobId, path });
    return { pdfUrl: signed.signedUrl, preview: true, jobId: input.jobId };
  }

  const { data: existingCertificate, error: existingCertErr } = await supabase
    .from('certificates')
    .select('id, job_id, pdf_path, pdf_url')
    .eq('job_id', input.jobId)
    .maybeSingle();
  if (existingCertErr) throw new Error(existingCertErr.message);

  const basePayload: Record<string, unknown> = { job_id: input.jobId };
  const certificatePayload: Record<string, unknown> = { ...basePayload, pdf_path: path };
  const writeCertificate = (payload: Record<string, unknown>) =>
    existingCertificate
      ? supabase.from('certificates').update(payload).eq('job_id', input.jobId)
      : supabase.from('certificates').insert(payload);

  console.log('GW: certificates write start', { jobId: input.jobId, path, previewOnly, payload: certificatePayload });
  const certRes = await writeCertificate(certificatePayload);
  console.log('GW: certificates write result', certRes);
  const certErr = (certRes as { error?: { code?: string; message: string } }).error;
  if (certErr) {
    console.error('GENERAL WORKS certificate write failed (pdf_path)', {
      jobId: input.jobId,
      payload: certificatePayload,
      code: certErr.code,
      message: certErr.message,
    });
    if (certErr.code === '42703') {
      const fallbackPayload: Record<string, unknown> = { ...basePayload, pdf_url: path };
      console.log('GW: certificates fallback write start', { jobId: input.jobId, path, payload: fallbackPayload });
      const fallbackRes = await writeCertificate(fallbackPayload);
      console.log('GW: certificates fallback write result', fallbackRes);
      const fallbackErr = (fallbackRes as { error?: { code?: string; message: string } }).error;
      if (fallbackErr) {
        console.error('GENERAL WORKS certificate write failed (pdf_url fallback)', {
          jobId: input.jobId,
          payload: fallbackPayload,
          code: fallbackErr.code,
          message: fallbackErr.message,
        });
        throw new Error(fallbackErr.message);
      }
    } else {
      throw new Error(certErr.message);
    }
  }

  const { data: signed, error: signedErr } = await supabase.storage.from('certificates').createSignedUrl(path, 60 * 10);
  if (signedErr || !signed?.signedUrl) {
    throw new Error(signedErr?.message ?? 'Unable to create signed URL for certificate');
  }

  console.log('GW: job_fields upsert start', {
    jobId: input.jobId,
    payload: { job_id: input.jobId, field_key: 'issued_at', value: issuedAt },
  });
  const issuedAtRes = await supabase
    .from(JOB_FIELDS_TABLE)
    .upsert({ job_id: input.jobId, field_key: 'issued_at', value: issuedAt } as Record<string, unknown>, {
      onConflict: 'job_id,field_key',
    });
  console.log('GW: job_fields upsert result', issuedAtRes);
  const issuedAtErr = (issuedAtRes as { error?: { code?: string; message: string } }).error;
  if (issuedAtErr) throw new Error(issuedAtErr.message);

  console.log('GW: jobs update (set status completed) start', {
    jobId: input.jobId,
    payload: { status: 'completed' },
  });
  let completeQuery = supabase
    .from('jobs')
    .update({ status: 'completed' } as Record<string, unknown>)
    .eq('id', input.jobId);
  if (jobOwnerId) {
    completeQuery = completeQuery.eq('user_id', jobOwnerId);
  }
  const jobCompleteRes = await completeQuery;
  console.log('GW: jobs update (set status completed) result', jobCompleteRes);
  if (jobCompleteRes.error) throw new Error(jobCompleteRes.error.message);
  revalidatePath(`/jobs/${input.jobId}`);
  console.log('GENERAL WORKS certificate stored', { jobId: input.jobId, path });
  return { pdfUrl: signed.signedUrl, jobId: input.jobId };
}

export async function generateGasServicePdf(payload: z.infer<typeof GenerateGasServicePdfSchema>) {
  const input = GenerateGasServicePdfSchema.parse(payload);
  const previewOnly = input.previewOnly ?? false;
  const cookieStore = await cookies();
  const sb = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options) {
          cookieStore.delete({ name, ...options });
        },
      },
    },
  );
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'generateGasServicePdf requires authenticated user');

  const jobContext = await loadJobContext(sb, input.jobId, 'generateGasServicePdf');
  if (jobContext.job.user_id && jobContext.job.user_id !== user.id) {
    throw new Error('RLS mismatch: job owner does not match auth user');
  }

  const { data: fields, error: fieldsErr } = await sb
    .from(JOB_FIELDS_TABLE)
    .select('field_key, value')
    .eq('job_id', input.jobId);
  if (fieldsErr) throw new Error(fieldsErr.message);
  const fieldRows = (fields ?? []) as unknown as JobFieldRow[];
  const fieldMap = Object.fromEntries(fieldRows.map((f) => [f.field_key, f.value ?? null]));
  const customer = resolveJobCustomer(jobContext, {
    name: typeof fieldMap.customer_name === 'string' ? fieldMap.customer_name : undefined,
    address: typeof fieldMap.customer_address === 'string' ? fieldMap.customer_address : undefined,
    phone: typeof fieldMap.customer_phone === 'string' ? fieldMap.customer_phone : undefined,
    email: typeof fieldMap.customer_email === 'string' ? fieldMap.customer_email : undefined,
  });
  const propertyAddress = resolveJobPropertyAddress(jobContext, {
    line1: typeof fieldMap.property_address === 'string' ? fieldMap.property_address : undefined,
    line2: typeof fieldMap.property_address_line2 === 'string' ? fieldMap.property_address_line2 : undefined,
    town: typeof fieldMap.property_town === 'string' ? fieldMap.property_town : undefined,
    postcode: typeof fieldMap.postcode === 'string' ? fieldMap.postcode : undefined,
    legacy: typeof fieldMap.address === 'string' ? fieldMap.address : undefined,
  });
  const mergedFieldMap = {
    ...fieldMap,
    customer_name: customer.name || fieldMap.customer_name,
    property_address: propertyAddress.summary || fieldMap.property_address,
    postcode: propertyAddress.postcode || fieldMap.postcode,
    customer_phone: customer.phone || fieldMap.customer_phone,
    customer_email: customer.email || fieldMap.customer_email,
  };

  const issuedAt = new Date();
  const issuedAtIso = issuedAt.toISOString();
  const validationErrors = previewOnly ? [] : validateBoilerServiceForIssue(mergedFieldMap);
  if (validationErrors.length) {
    throw new Error(`Boiler service validation failed: ${validationErrors.join('; ')}`);
  }

  const toText = (val: unknown) => (val === undefined || val === null ? '' : String(val));
  const getFieldText = (key: string) => toText(fieldMap[key]);
  const boilerMake = getFieldText('boiler_make');
  const boilerModel = getFieldText('boiler_model');
  const boilerAddress = pickText(propertyAddress.summary, toText(fieldMap.property_address ?? fieldMap.address ?? ''));

  const gasServiceFields: GasServiceFieldMap = {
    certNumber: toText(fieldMap.record_id ?? fieldMap.certificate_number ?? input.jobId ?? ''),
    engineerName: toText(fieldMap.engineer_name ?? ''),
    companyName: toText(fieldMap.company_name ?? ''),
    companyAddressLine1: toText(fieldMap.company_address ?? ''),
    companyAddressLine2: '',
    companyTown: '',
    companyPostcode: '',
    companyPhone: toText(fieldMap.company_phone ?? ''),
    gasSafeNumber: toText(fieldMap.gas_safe_number ?? ''),
    engineerId: toText(fieldMap.engineer_id ?? ''),
    jobName: customer.name || toText(fieldMap.customer_name ?? ''),
    jobAddressLine1: boilerAddress,
    jobAddressLine2: '',
    jobTown: '',
    jobPostcode: pickText(propertyAddress.postcode, toText(fieldMap.postcode ?? '')),
    jobPhone: customer.phone || '',
    clientName: customer.name || toText(fieldMap.customer_name ?? ''),
    clientCompany: customer.organization || '',
    clientAddressLine1: boilerAddress,
    clientAddressLine2: '',
    clientTown: '',
    clientPostcode: pickText(propertyAddress.postcode, toText(fieldMap.postcode ?? '')),
    clientPhone: customer.phone || '',
    nextServiceDate: getFieldText('next_service_due'),
    engineerComments: [
      getFieldText('service_summary'),
      getFieldText('recommendations'),
      getFieldText('defects_details'),
      getFieldText('parts_used'),
    ]
      .filter((value) => value.trim().length > 0)
      .join(' | '),
  };

  const appliances: GasServiceApplianceInput[] = [
    {
      description: [boilerMake, boilerModel].filter(Boolean).join(' ') || getFieldText('boiler_type'),
      location: getFieldText('boiler_location'),
      type: getFieldText('boiler_type'),
      make: boilerMake,
      model: boilerModel,
      serial: getFieldText('serial_number'),
      flueType: getFieldText('flue_type'),
      operatingPressure: getFieldText('operating_pressure_mbar'),
      heatInput: getFieldText('heat_input'),
      safetyDevice: getFieldText('service_controls_checked'),
      ventilationSatisfactory: getFieldText('service_ventilation_checked'),
      flueTerminationSatisfactory: getFieldText('service_flue_checked'),
      spillageTest: getFieldText('service_visual_inspection'),
      applianceSafeToUse: getFieldText('service_leaks_checked'),
      remedialActionTaken: getFieldText('defects_found'),
    },
  ].filter((row) => Object.values(row).some((val) => typeof val === 'string' && val.trim().length > 0));

  const pdfBytes = await renderGasServicePdf({
    fields: gasServiceFields,
    appliances,
    issuedAt,
    recordId: input.jobId,
  });

  console.log('GAS SERVICE: service role key present', Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY));
  const admin = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const pathBase = previewOnly ? 'boiler-service/previews' : 'boiler-service';
  const path = `${pathBase}/${input.jobId}/${Date.now()}-boiler-service${previewOnly ? '-preview' : ''}.pdf`;
  console.log('GAS SERVICE: uploading certificate PDF', { path, previewOnly });
  const { data: uploadData, error: uploadErr } = await admin.storage
    .from('certificates')
    .upload(path, Buffer.from(pdfBytes), { contentType: 'application/pdf', cacheControl: '3600', upsert: false });
  if (uploadErr) {
    const statusCode = 'statusCode' in uploadErr ? uploadErr.statusCode : undefined;
    console.error('Storage upload failed', {
      storagePath: path,
      message: uploadErr.message,
      name: uploadErr.name,
      statusCode,
    });
    throw uploadErr;
  }
  if (!uploadData?.path) {
    throw new Error('Certificate PDF upload failed: missing path');
  }

  if (previewOnly) {
    const { data: signed, error: signedErr } = await admin.storage.from('certificates').createSignedUrl(path, 60 * 10);
    if (signedErr || !signed?.signedUrl) {
      throw new Error(signedErr?.message ?? 'Unable to create signed URL for certificate');
    }
    console.log('GAS SERVICE PDF preview generated', { jobId: input.jobId, path });
    return { pdfUrl: signed.signedUrl, preview: true, jobId: input.jobId };
  }

  const { data: existingCertificate, error: existingCertErr } = await admin
    .from('certificates')
    .select('id, job_id, pdf_path, pdf_url')
    .eq('job_id', input.jobId)
    .maybeSingle();
  if (existingCertErr) throw new Error(existingCertErr.message);

  const baseCertificatePayload: Record<string, unknown> = {
    job_id: input.jobId,
  };
  const certificatePayload: Record<string, unknown> = { ...baseCertificatePayload, pdf_path: path };

  const writeCertificate = (payload: Record<string, unknown>) =>
    existingCertificate
      ? admin.from('certificates').update(payload).eq('job_id', input.jobId)
      : admin.from('certificates').insert(payload);

  console.log('GAS SERVICE: certificates write start', { jobId: input.jobId, path, previewOnly, payload: certificatePayload });
  const { error: certErr } = await writeCertificate(certificatePayload);
  console.log('GAS SERVICE: certificates write result', {
    jobId: input.jobId,
    error: certErr
      ? {
          code: certErr.code,
          message: certErr.message,
          details: certErr.details,
          hint: certErr.hint,
        }
      : null,
  });
  if (certErr) {
    console.error('GAS SERVICE certificate write failed (pdf_path)', {
      jobId: input.jobId,
      payload: certificatePayload,
      code: certErr.code,
      message: certErr.message,
    });
    if (certErr.code === '42703') {
      const fallbackPayload: Record<string, unknown> = { ...baseCertificatePayload, pdf_url: path };
      const { error: fallbackErr } = await writeCertificate(fallbackPayload);
      if (fallbackErr) {
        console.error('GAS SERVICE certificate write failed (pdf_url fallback)', {
          jobId: input.jobId,
          payload: fallbackPayload,
          code: fallbackErr.code,
          message: fallbackErr.message,
        });
        throw new Error(fallbackErr.message);
      }
    } else {
      throw new Error(certErr.message);
    }
  }
  console.log('GAS SERVICE certificate stored', { jobId: input.jobId, path });

  const { data: signed, error: signedErr } = await admin.storage.from('certificates').createSignedUrl(path, 60 * 10);
  if (signedErr || !signed?.signedUrl) {
    throw new Error(signedErr?.message ?? 'Unable to create certificate link');
  }
  console.log('GAS SERVICE certificate signed URL generated', { jobId: input.jobId, path });

  await sb
    .from(JOB_FIELDS_TABLE)
    .upsert({ job_id: input.jobId, field_key: 'issued_at', value: issuedAtIso } as Record<string, unknown>, {
      onConflict: 'job_id,field_key',
    });

  await sb
    .from('jobs')
    .update({ status: 'completed' } as Record<string, unknown>)
    .eq('id', input.jobId);
  revalidatePath(`/jobs/${input.jobId}`);
  return { pdfUrl: signed.signedUrl, jobId: input.jobId };
}

const GeneratePdfSchema = z.object({
  jobId: z.string().uuid(),
  certificateType: z.enum(CERTIFICATE_TYPES),
  previewOnly: z.boolean().optional().default(false),
  fields: z.record(z.string(), z.unknown()).optional(),
});

type CertificatePaths = Pick<Database['public']['Tables']['certificates']['Row'], 'pdf_path' | 'pdf_url'> | null | undefined;

export async function getCertificateState(c?: CertificatePaths) {
  const pdfPath = c?.pdf_path ?? c?.pdf_url;
  if (!pdfPath) return 'missing';
  return 'ready';
}

const GetCertificatePdfSignedUrlSchema = z.object({
  jobId: z.string().uuid(),
});

export async function generateCertificatePdf(payload: z.infer<typeof GeneratePdfSchema>) {
  const input = GeneratePdfSchema.parse(payload);
  const previewOnly = input.previewOnly ?? false;
  const cookieStore = await cookies();
  const sb = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options) {
          cookieStore.delete({ name, ...options });
        },
      },
    },
  );
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'generateCertificatePdf requires authenticated user');
  console.log('CERT PDF AUTH UID:', user.id);

  const jobContext = await loadJobContext(sb, input.jobId, 'generateCertificatePdf');
  if (jobContext.job.user_id && jobContext.job.user_id !== user.id) {
    throw new Error('RLS mismatch: job owner does not match auth user');
  }

  const { data: existingCertificate, error: existingCertErr } = await sb.from('certificates').select('id, job_id').eq('job_id', input.jobId).maybeSingle();
  if (existingCertErr) throw new Error(existingCertErr.message);
  console.log('CERTIFICATE existing row', { jobId: input.jobId, exists: !!existingCertificate, id: existingCertificate?.id });

  if (input.certificateType === 'gas_service') {
    return generateGasServicePdf({ jobId: input.jobId, previewOnly });
  }

  if (input.certificateType === 'general_works') {
    console.log('GW-PDF generateCertificatePdf dispatch start', { jobId: input.jobId, previewOnly });
    const response = await generateGeneralWorksPdf({ jobId: input.jobId, previewOnly });
    console.log('GW-PDF generateCertificatePdf dispatch result', { jobId: input.jobId, previewOnly });
    return response;
  }

  if (input.certificateType === 'gas_warning_notice') {
    const { data: fields, error: fieldsErr } = await sb
      .from(JOB_FIELDS_TABLE)
      .select('field_key, value')
      .eq('job_id', input.jobId);
    if (fieldsErr) throw new Error(fieldsErr.message);
    const fieldRows = (fields ?? []) as unknown as JobFieldRow[];
    const fieldMap = Object.fromEntries(fieldRows.map((f) => [f.field_key, f.value ?? null]));
    const mergedFieldMap = {
      ...fieldMap,
      ...(input.fields ?? {}),
    } as Record<string, unknown>;
    const customer = resolveJobCustomer(jobContext, {
      name: typeof mergedFieldMap.customer_name === 'string' ? mergedFieldMap.customer_name : undefined,
      phone: typeof mergedFieldMap.customer_phone === 'string' ? mergedFieldMap.customer_phone : undefined,
      email: typeof mergedFieldMap.customer_email === 'string' ? mergedFieldMap.customer_email : undefined,
    });
    const propertyAddress = resolveJobPropertyAddress(jobContext, {
      line1: typeof mergedFieldMap.property_address === 'string' ? mergedFieldMap.property_address : undefined,
      postcode: typeof mergedFieldMap.postcode === 'string' ? mergedFieldMap.postcode : undefined,
      legacy: typeof mergedFieldMap.address === 'string' ? mergedFieldMap.address : undefined,
    });

    const issuedAt = new Date();
    const issuedAtIso = issuedAt.toISOString();
    const toText = (val: unknown) => (val === undefined || val === null ? '' : String(val));
    const customerContact = pickText(
      customer.phone,
      customer.email,
      toText(mergedFieldMap.customer_contact ?? mergedFieldMap.customer_phone ?? mergedFieldMap.customer_email ?? ''),
    );
    const gasWarningFields: GasWarningNoticeFields = {
      property_address: pickText(propertyAddress.summary, toText(mergedFieldMap.property_address ?? mergedFieldMap.address ?? '')),
      postcode: pickText(propertyAddress.postcode, toText(mergedFieldMap.postcode ?? '')),
      customer_name: customer.name || toText(mergedFieldMap.customer_name ?? ''),
      customer_contact: customerContact,
      appliance_location: toText(mergedFieldMap.appliance_location ?? ''),
      appliance_type: toText(mergedFieldMap.appliance_type ?? ''),
      make_model: toText(mergedFieldMap.make_model ?? ''),
      gas_supply_isolated: toText(mergedFieldMap.gas_supply_isolated ?? ''),
      appliance_capped_off: toText(mergedFieldMap.appliance_capped_off ?? ''),
      customer_refused_isolation: toText(mergedFieldMap.customer_refused_isolation ?? ''),
      classification: toText(mergedFieldMap.classification ?? ''),
      classification_code: toText(mergedFieldMap.classification_code ?? ''),
      unsafe_situation_description: toText(mergedFieldMap.unsafe_situation_description ?? ''),
      underlying_cause: toText(mergedFieldMap.underlying_cause ?? ''),
      actions_taken: toText(mergedFieldMap.actions_taken ?? ''),
      emergency_services_contacted: toText(mergedFieldMap.emergency_services_contacted ?? ''),
      emergency_reference: toText(mergedFieldMap.emergency_reference ?? ''),
      danger_do_not_use_label_fitted: toText(mergedFieldMap.danger_do_not_use_label_fitted ?? ''),
      meter_or_appliance_tagged: toText(mergedFieldMap.meter_or_appliance_tagged ?? ''),
      customer_informed: toText(mergedFieldMap.customer_informed ?? ''),
      customer_understands_risks: toText(mergedFieldMap.customer_understands_risks ?? ''),
      customer_signature_url: toText(mergedFieldMap.customer_signature ?? mergedFieldMap.customer_signature_url ?? ''),
      customer_signed_at: toText(mergedFieldMap.customer_signed_at ?? ''),
      engineer_name: toText(mergedFieldMap.engineer_name ?? ''),
      engineer_company: toText(mergedFieldMap.engineer_company ?? mergedFieldMap.company_name ?? ''),
      gas_safe_number: toText(mergedFieldMap.gas_safe_number ?? ''),
      engineer_id_card_number: toText(mergedFieldMap.engineer_id_card_number ?? mergedFieldMap.engineer_id ?? ''),
      engineer_signature_url: toText(mergedFieldMap.engineer_signature ?? mergedFieldMap.engineer_signature_url ?? ''),
      issued_at: toText(mergedFieldMap.issued_at ?? issuedAtIso),
      record_id: toText(mergedFieldMap.record_id ?? input.jobId),
    };

    const validationErrors = previewOnly ? [] : validateGasWarningNoticeForIssue(gasWarningFields);
    if (validationErrors.length) {
      throw new Error(`Gas warning notice validation failed: ${validationErrors.join('; ')}`);
    }

    const admin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const pdfBytes = await renderGasWarningNoticePdf({
      fields: gasWarningFields,
      issuedAt: gasWarningFields.issued_at ?? issuedAtIso,
      recordId: gasWarningFields.record_id ?? input.jobId,
    });

    const pathBase = previewOnly ? 'gas-warning-notice/previews' : 'gas-warning-notice';
    const path = `${pathBase}/${input.jobId}/${Date.now()}-gas-warning-notice${previewOnly ? '-preview' : ''}.pdf`;
    const { data: uploadData, error: uploadErr } = await admin.storage
      .from('certificates')
      .upload(path, Buffer.from(pdfBytes), { contentType: 'application/pdf', cacheControl: '3600', upsert: false });
    if (uploadErr) {
      throw uploadErr;
    }
    if (!uploadData?.path) {
      throw new Error('Gas warning notice PDF upload failed: missing path');
    }

    if (previewOnly) {
      const { data: signed, error: signedErr } = await admin.storage.from('certificates').createSignedUrl(path, 60 * 10);
      if (signedErr || !signed?.signedUrl) {
        throw new Error(signedErr?.message ?? 'Unable to create signed URL for certificate');
      }
      return { pdfUrl: signed.signedUrl, preview: true, jobId: input.jobId };
    }

    const baseCertificatePayload: Record<string, unknown> = {
      job_id: input.jobId,
    };
    const certificatePayload: Record<string, unknown> = { ...baseCertificatePayload, pdf_path: path };
    const writeCertificate = (payload: Record<string, unknown>) =>
      existingCertificate
        ? admin.from('certificates').update(payload).eq('job_id', input.jobId)
        : admin.from('certificates').insert(payload);
    const { error: certErr } = await writeCertificate(certificatePayload);
    if (certErr) {
      throw new Error(certErr.message);
    }
    await admin
      .from('jobs')
      .update({ status: 'completed' } as Record<string, unknown>)
      .eq('id', input.jobId);
    revalidatePath(`/jobs/${input.jobId}`);
    return { pdfUrl: admin.storage.from('certificates').getPublicUrl(path).data.publicUrl, jobId: input.jobId };
  }

  if (input.certificateType !== 'cp12') {
    const pdfUrl = `https://placehold.co/1200x1600?text=${encodeURIComponent(
      `${CERTIFICATE_LABELS[input.certificateType]} PDF`,
    )}`;
    if (!previewOnly) {
      const certificatePayload = { job_id: input.jobId, pdf_url: pdfUrl };
      const writeCertificate = existingCertificate
        ? sb.from('certificates').update(certificatePayload).eq('job_id', input.jobId)
        : sb.from('certificates').insert(certificatePayload);
      const { error: certificateWriteErr } = await writeCertificate;
      if (certificateWriteErr) {
        console.error('CERTIFICATE write failed (non-CP12)', {
          jobId: input.jobId,
          payload: certificatePayload,
          code: certificateWriteErr.code,
          message: certificateWriteErr.message,
        });
        throw new Error(certificateWriteErr.message);
      }
      await sb.from('jobs').update({ status: 'completed' }).eq('id', input.jobId);
      revalidatePath(`/jobs/${input.jobId}`);
    }
    return { pdfUrl, jobId: input.jobId };
  }

  const { data: fields, error: fieldsErr } = await sb
    .from(JOB_FIELDS_TABLE)
    .select('field_key, value')
    .eq('job_id', input.jobId);
  if (fieldsErr) throw new Error(fieldsErr.message);
  const fieldRows = (fields ?? []) as unknown as JobFieldRow[];
  const fieldMap = Object.fromEntries(fieldRows.map((f) => [f.field_key, f.value ?? null]));

  let appliances: Cp12Appliance[] = [];
  const appResp = await sb.from(CP12_APPLIANCES_TABLE).select('*').eq('job_id', input.jobId);
  if (appResp.error) {
    if (appResp.error.code !== '42P01') throw new Error(appResp.error.message);
  } else if (appResp.data) {
    appliances = appResp.data as unknown as Cp12Appliance[];
  }

  const issuedAt = new Date();
  const customer = resolveJobCustomer(jobContext, {
    name: typeof fieldMap.customer_name === 'string' ? fieldMap.customer_name : undefined,
  });
  const propertyAddress = resolveJobPropertyAddress(jobContext, {
    line1: typeof fieldMap.property_address === 'string' ? fieldMap.property_address : undefined,
    postcode: typeof fieldMap.postcode === 'string' ? fieldMap.postcode : undefined,
    legacy: typeof fieldMap.address === 'string' ? fieldMap.address : undefined,
  });
  const validationFieldMap = {
    ...fieldMap,
    customer_name: customer.name || fieldMap.customer_name,
    property_address: propertyAddress.summary || fieldMap.property_address,
    postcode: propertyAddress.postcode || fieldMap.postcode,
  };
  const validationErrors = previewOnly ? [] : validateCp12ForIssue(validationFieldMap, appliances);
  if (validationErrors.length) {
    throw new Error(`CP12 validation failed: ${validationErrors.join('; ')}`);
  }

  console.log('CP12: service role key present', Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY));
  const admin = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const toText = (val: unknown) => (val === undefined || val === null ? '' : String(val));
  const cp12Fields: Cp12FieldMap = {
    certNumber: toText(fieldMap.record_id ?? fieldMap.certificate_number ?? ''),
    issueDate: toText(fieldMap.inspection_date ?? fieldMap.scheduled_for ?? '') || undefined,
    nextInspectionDue: toText(fieldMap.next_inspection_due ?? fieldMap.completion_date ?? ''),
    landlordName: toText(fieldMap.landlord_name ?? customer.name ?? ''),
    landlordAddressLine1: toText(fieldMap.landlord_address ?? ''),
    landlordPostcode: toText(fieldMap.postcode ?? ''),
    propertyAddressLine1: pickText(propertyAddress.summary, toText(fieldMap.property_address ?? fieldMap.address ?? '')),
    propertyPostcode: pickText(propertyAddress.postcode, toText(fieldMap.postcode ?? '')),
    companyName: toText(fieldMap.company_name ?? ''),
    companyAddressLine1: toText(fieldMap.company_address ?? ''),
    companyTown: '',
    companyPostcode: '',
    companyPhone: toText(fieldMap.company_phone ?? ''),
    companyEmail: toText(fieldMap.company_email ?? ''),
    gasSafeRegistrationNumber: toText(fieldMap.gas_safe_number ?? ''),
    engineerName: toText(fieldMap.engineer_name ?? ''),
    engineerIdNumber: toText(fieldMap.engineer_id ?? ''),
    engineerSignatureText: toText(fieldMap.engineer_name ?? ''),
    engineerVisitTime: toText(fieldMap.completion_date ?? ''),
    responsiblePersonName: toText(customer.name ?? ''),
    responsiblePersonSignatureText: toText(customer.name ?? ''),
    responsiblePersonAcknowledgementDate: toText(fieldMap.completion_date ?? ''),
    defectsIdentified: toText(fieldMap.defect_description ?? ''),
    remedialWorksRequired: toText(fieldMap.remedial_action ?? ''),
    additionalNotes: toText(fieldMap.comments ?? fieldMap.additional_notes ?? ''),
  };

  const applianceInputs: ApplianceInput[] = (appliances ?? []).map((app) => {
    const appExtras = app as Cp12Appliance & { appliance_make_model?: string };
    return {
      description: toText(app.make_model ?? appExtras.appliance_make_model ?? app.appliance_type ?? ''),
      location: toText(app.location ?? ''),
      type: toText(app.appliance_type ?? ''),
      flueType: toText(app.flue_type ?? app.ventilation_provision ?? ''),
      operatingPressure: toText(app.operating_pressure ?? ''),
      heatInput: toText(app.heat_input ?? ''),
      safetyDevice: toText(app.stability_test ?? ''),
      ventilationSatisfactory: toText(app.ventilation_satisfactory ?? app.ventilation_provision ?? ''),
      flueTerminationSatisfactory: toText(app.flue_condition ?? ''),
      spillageTest: toText(app.gas_tightness_test ?? ''),
      applianceSafeToUse: toText(app.safety_rating ?? app.classification_code ?? ''),
      remedialActionTaken: toText(app.classification_code ?? ''),
    };
  });

  const pdfBytes = await renderCp12CertificatePdf({
    fields: cp12Fields,
    appliances: applianceInputs,
    issuedAt,
    recordId: input.jobId,
  });
  const pathBase = previewOnly ? 'cp12/previews' : 'cp12';
  const path = `${pathBase}/${user.id}/${input.jobId}-${previewOnly ? 'preview' : Date.now()}.pdf`;
  console.log('CP12: uploading certificate PDF', { path, previewOnly });
  const upload = await admin.storage
    .from('certificates')
    .upload(path, Buffer.from(pdfBytes), { contentType: 'application/pdf', upsert: true });
  if (upload.error || !upload.data?.path) {
    console.error('CP12: upload error', {
      path,
      error: upload.error
        ? {
            message: upload.error.message,
            name: upload.error.name,
            statusCode: 'statusCode' in upload.error ? upload.error.statusCode : undefined,
          }
        : null,
    });
    throw new Error(upload.error?.message ?? 'Certificate PDF upload failed');
  }

  if (previewOnly) {
    const { data: signed, error: signedErr } = await admin.storage.from('certificates').createSignedUrl(path, 60 * 10);
    if (signedErr || !signed?.signedUrl) {
      throw new Error(signedErr?.message ?? 'Unable to create signed URL for certificate');
    }
    console.log('CERTIFICATE PDF preview generated', { jobId: input.jobId, path });
    return { pdfUrl: signed.signedUrl, preview: true, jobId: input.jobId };
  }

  const baseCertificatePayload: Record<string, unknown> = {
    job_id: input.jobId,
  };
  const certificatePayload: Record<string, unknown> = { ...baseCertificatePayload, pdf_path: path };

  const writeCertificate = (payload: Record<string, unknown>) =>
    existingCertificate
      ? admin.from('certificates').update(payload).eq('job_id', input.jobId)
      : admin.from('certificates').insert(payload);

  console.log('CP12: certificates write start', { jobId: input.jobId, path, previewOnly, payload: certificatePayload });
  const { error: certErr } = await writeCertificate(certificatePayload);
  console.log('CP12: certificates write result', {
    jobId: input.jobId,
    error: certErr
      ? {
          code: certErr.code,
          message: certErr.message,
          details: certErr.details,
          hint: certErr.hint,
        }
      : null,
  });
  if (certErr) {
    console.error('CERTIFICATE write failed (pdf_path)', {
      jobId: input.jobId,
      payload: certificatePayload,
      code: certErr.code,
      message: certErr.message,
    });
    if (certErr.code === '42703') {
      const fallbackPayload: Record<string, unknown> = { ...baseCertificatePayload, pdf_url: path };
      const { error: fallbackErr } = await writeCertificate(fallbackPayload);
      if (fallbackErr) {
        console.error('CERTIFICATE write failed (pdf_url fallback)', {
          jobId: input.jobId,
          payload: fallbackPayload,
          code: fallbackErr.code,
          message: fallbackErr.message,
        });
        if (fallbackErr.code === '42703') {
          const { error: finalErr } = await writeCertificate(fallbackPayload);
          if (finalErr) {
            console.error('CERTIFICATE write failed (fallback retry)', {
              jobId: input.jobId,
              payload: fallbackPayload,
              code: finalErr.code,
              message: finalErr.message,
            });
            throw new Error(finalErr.message);
          }
        } else {
          throw new Error(fallbackErr.message);
        }
      }
    } else {
      throw new Error(certErr.message);
    }
  }
  console.log('CERTIFICATE PDF stored', { jobId: input.jobId, path });

  const { data: signed, error: signedErr } = await admin.storage.from('certificates').createSignedUrl(path, 60 * 10);
  if (signedErr || !signed?.signedUrl) {
    throw new Error(signedErr?.message ?? 'Unable to create certificate link');
  }
  console.log('CERTIFICATE PDF signed URL generated', { jobId: input.jobId, path });

  await sb
    .from(JOB_FIELDS_TABLE)
    .upsert({ job_id: input.jobId, field_key: 'issued_at', value: issuedAt } as Record<string, unknown>, {
      onConflict: 'job_id,field_key',
    });

  await sb.from('jobs').update({ status: 'completed' }).eq('id', input.jobId);
  revalidatePath(`/jobs/${input.jobId}`);
  return { pdfUrl: signed.signedUrl, jobId: input.jobId };
}

export async function getCertificatePdfSignedUrl(payload: z.infer<typeof GetCertificatePdfSignedUrlSchema> | string) {
  const input = typeof payload === 'string' ? { jobId: payload } : payload;
  const { jobId } = GetCertificatePdfSignedUrlSchema.parse(input);
  const sb = await supabaseServerServiceRole();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  const { data: job, error: jobErr } = await sb.from('jobs').select('user_id').eq('id', jobId).maybeSingle();
  if (jobErr) throw new Error(jobErr.message);
  if (!job) throw new Error('Job not found');
  if (job.user_id !== user.id) {
    throw new Error('RLS mismatch: job owner does not match auth user');
  }

  const { data: certificate, error: certificateErr } = await sb
    .from('certificates')
    .select('job_id, pdf_path, pdf_url')
    .eq('job_id', jobId)
    .maybeSingle();
  if (certificateErr) throw new Error(certificateErr.message);
  if (!certificate) {
    throw new Error('No PDF found for this job');
  }

  const pdfPath = certificate.pdf_path ?? certificate.pdf_url;
  if (!pdfPath) throw new Error('No PDF found for this job');

  if (typeof pdfPath === 'string' && pdfPath.startsWith('http')) {
    console.log('CERTIFICATE PDF signed URL (public)', { jobId, path: pdfPath });
    return { url: pdfPath };
  }

  const { data: signed, error: signedErr } = await sb.storage.from('certificates').createSignedUrl(pdfPath as string, 60 * 10);
  if (signedErr || !signed?.signedUrl) {
    throw new Error(signedErr?.message ?? 'Unable to create certificate link');
  }
  console.log('CERTIFICATE PDF signed URL created', { jobId, path: pdfPath });

  return { url: signed.signedUrl };
}

const SendPdfSchema = z.object({
  jobId: z.string().uuid(),
});

export async function sendPdfToClient(payload: z.infer<typeof SendPdfSchema>) {
  const input = SendPdfSchema.parse(payload);
  const sb = await supabaseServerServiceRole();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  await sb.from('jobs').update({ status: 'completed' }).eq('id', input.jobId).eq('user_id', user.id);

  revalidatePath(`/jobs/${input.jobId}`);
  return { ok: true, sentAt: new Date().toISOString() };
}
