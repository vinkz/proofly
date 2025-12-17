'use server';

import { revalidatePath } from 'next/cache';
import { Buffer } from 'node:buffer';
import { z } from 'zod';

import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/lib/database.types';
import { supabaseServerReadOnly, supabaseServerServiceRole } from '@/lib/supabaseServer';
import type { JobFieldPayload, CertificateType, PhotoCategory, Cp12Appliance } from '@/types/certificates';
import { CERTIFICATE_TYPES, PHOTO_CATEGORIES, CERTIFICATE_LABELS } from '@/types/certificates';
import type { BoilerServicePhotoCategory } from '@/types/boiler-service';
import { BOILER_SERVICE_PHOTO_CATEGORIES, BOILER_SERVICE_REQUIRED_FOR_ISSUE } from '@/types/boiler-service';
import { renderBoilerServicePdf } from '@/lib/pdf/boiler-service';
import type { GeneralWorksPhotoCategory } from '@/types/general-works';
import { GENERAL_WORKS_PHOTO_CATEGORIES, GENERAL_WORKS_REQUIRED_FIELDS } from '@/types/general-works';
import { renderGeneralWorksPdf } from '@/lib/pdf/general-works';

type JobInsertPayload = {
  certificateType: CertificateType;
  title?: string | null;
  clientName?: string | null;
  address?: string | null;
  scheduledFor?: string | null;
};

async function persistJobFields(
  sb: Awaited<ReturnType<typeof supabaseServerServiceRole>>,
  jobId: string,
  entries: { job_id: string; field_key: string; value: string | null }[],
  label: string,
) {
  if (!entries.length) return;
  const keys = entries.map((e) => e.field_key);
  console.log(`${label}: deleting existing job_fields`, { jobId, keys });
  const { error: delErr } = await sb.from('job_fields').delete().eq('job_id', jobId).in('field_key', keys);
  if (delErr) {
    console.error(`${label}: delete job_fields failed`, { jobId, error: delErr });
    throw new Error(delErr.message);
  }
  const { data, error: insErr } = await sb.from('job_fields').insert(entries).select();
  console.log(`${label}: inserted job_fields`, { jobId, count: data?.length ?? 0, error: insErr });
  if (insErr) {
    throw new Error(insErr.message);
  }
}

const CreateJobSchema = z.object({
  certificateType: z.enum(CERTIFICATE_TYPES),
  title: z.string().optional(),
  clientName: z.string().optional(),
  address: z.string().optional(),
  scheduledFor: z.string().optional(),
});

export async function createJob(payload: JobInsertPayload) {
  const input = CreateJobSchema.parse(payload);
  const readClient = await supabaseServerReadOnly();
  const {
    data: { user },
    error,
  } = await readClient.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  const sb = await supabaseServerServiceRole();
  const { data, error: insertErr } = await sb
    .from('jobs')
    .insert({
      certificate_type: input.certificateType,
      status: 'draft',
      title: input.title ?? `${CERTIFICATE_LABELS[input.certificateType]} draft`,
      client_name: input.clientName ?? null,
      address: input.address ?? null,
      scheduled_for: input.scheduledFor ?? null,
      user_id: user.id,
    })
    .select('id, certificate_type, status')
    .single();

  if (insertErr || !data) {
    throw new Error(insertErr?.message ?? 'Unable to start certificate');
  }

  return { jobId: data.id as string };
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
    certificate_type: input.certificateType,
  };

  await sb.from('jobs').update(coreUpdates).eq('id', jobId).eq('user_id', user.id);

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

  const { error: insertErr } = await sb
    .from('job_photos')
    .insert({ job_id: id, category: cat, file_url: publicUrl, user_id: user.id });
  if (insertErr) throw new Error(insertErr.message);

  revalidatePath(`/jobs/${id}`);
  return { url: publicUrl };
}

export async function getCertificateWizardState(jobId: string) {
  const sb = await supabaseServerReadOnly();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  const { data: job, error: jobErr } = await sb.from('jobs').select('*').eq('id', jobId).eq('user_id', user.id).maybeSingle();
  if (jobErr || !job) throw new Error(jobErr?.message ?? 'Job not found');

  const { data: fields, error: fieldsErr } = await sb.from('job_fields').select('field_key, value').eq('job_id', jobId);
  if (fieldsErr) throw new Error(fieldsErr.message);
  const fieldRecord = Object.fromEntries((fields ?? []).map((f) => [f.field_key, f.value ?? null]));
  const photoNotes: Record<string, string> = {};
  Object.entries(fieldRecord).forEach(([key, value]) => {
    if (key.startsWith('photo_note_') && typeof value === 'string') {
      photoNotes[key.replace('photo_note_', '')] = value;
    }
  });

  const { data: photos, error: photosErr } = await sb
    .from('job_photos')
    .select('category, file_url')
    .eq('job_id', jobId);
  if (photosErr) throw new Error(photosErr.message);
  const photoPreviews: Record<string, string> = {};
  (photos ?? []).forEach((photo) => {
    if (photo.category && photo.file_url && !photoPreviews[photo.category]) {
      photoPreviews[photo.category] = photo.file_url;
    }
  });

  let appliances: Cp12Appliance[] = [];
  const appResp = await sb.from('cp12_appliances').select('*').eq('job_id', jobId);
  if (appResp.error) {
    if (appResp.error.code !== '42P01') throw new Error(appResp.error.message);
  } else if (appResp.data) {
    appliances = appResp.data as Cp12Appliance[];
  }

  return {
    job,
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
    .from('job_fields')
    .delete()
    .eq('job_id', input.jobId)
    .eq('field_key', input.key);

  const { error: insErr } = await sb.from('job_fields').insert({
    job_id: input.jobId,
    field_key: input.key,
    value: input.value ?? null,
  });
  if (insErr) {
    console.error('updateField insert failed', { jobId: input.jobId, key: input.key, error: insErr });
    throw new Error(insErr.message);
  }

  revalidatePath(`/jobs/${input.jobId}`);
  return { ok: true };
}

const optionalText = z.string().optional().default('');

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

const BoilerServicePhotoSchema = z.object({
  jobId: z.string().uuid(),
  category: z.enum(BOILER_SERVICE_PHOTO_CATEGORIES as [BoilerServicePhotoCategory, ...BoilerServicePhotoCategory[]]),
  file: z.instanceof(File),
});

const GeneralWorksInfoSchema = z.object({
  jobId: z.string().uuid(),
  data: z.record(z.string(), z.string().optional().nullable()),
});

const GeneralWorksPhotoSchema = z.object({
  jobId: z.string().uuid(),
  category: z.enum(GENERAL_WORKS_PHOTO_CATEGORIES as [GeneralWorksPhotoCategory, ...GeneralWorksPhotoCategory[]]),
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
  const { error: updateErr } = await sb
    .from('jobs')
    .update({
      client_name: data.customer_name,
      address: data.property_address,
      scheduled_for: data.service_date || null,
      title: data.customer_name ? `Boiler Service for ${data.customer_name}` : 'Boiler Service draft',
      certificate_type: 'boiler_service',
    })
    .eq('id', jobId)
    .eq('user_id', user.id);
  if (updateErr) throw new Error(updateErr.message);

  const entries = Object.entries(data).map(([key, value]) => ({
    job_id: jobId,
    field_key: key,
    value: value ?? null,
  }));
  await persistJobFields(sb, jobId, entries, 'saveBoilerServiceJobInfo');
  revalidatePath(`/wizard/create/boiler_service?jobId=${jobId}`);
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

  const entries = Object.entries(input.data).map(([key, value]) => ({
    job_id: input.jobId,
    field_key: key,
    value: value ?? null,
  }));
  await persistJobFields(sb, input.jobId, entries, 'saveBoilerServiceDetails');
  await sb.from('jobs').update({ certificate_type: 'boiler_service' }).eq('id', input.jobId).eq('user_id', user.id);
  revalidatePath(`/wizard/create/boiler_service?jobId=${input.jobId}`);
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

  const entries = Object.entries(input.data).map(([key, value]) => ({
    job_id: input.jobId,
    field_key: key,
    value: value ?? null,
  }));
  await persistJobFields(sb, input.jobId, entries, 'saveBoilerServiceChecks');
  await sb.from('jobs').update({ certificate_type: 'boiler_service' }).eq('id', input.jobId).eq('user_id', user.id);
  revalidatePath(`/wizard/create/boiler_service?jobId=${input.jobId}`);
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

  const { error: insertErr } = await sb
    .from('job_photos')
    .insert({ job_id: jobId, category, file_url: publicUrl, user_id: user.id });
  if (insertErr) throw new Error(insertErr.message);

  await sb.from('jobs').update({ certificate_type: 'boiler_service' }).eq('id', jobId).eq('user_id', user.id);

  revalidatePath(`/wizard/create/boiler_service?jobId=${jobId}`);
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
    certificate_type: 'general_works',
    address: data.property_address ?? null,
    client_name: data.customer_name ?? null,
    scheduled_for: data.work_date ?? null,
    title: data.work_summary ? `General Works - ${data.work_summary}` : 'General Works draft',
  };
  await sb.from('jobs').update(updates).eq('id', jobId).eq('user_id', user.id);

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

  const { error: insertErr } = await sb
    .from('job_photos')
    .insert({ job_id: jobId, category, file_url: publicUrl, user_id: user.id });
  if (insertErr) throw new Error(insertErr.message);

  await sb.from('jobs').update({ certificate_type: 'general_works' }).eq('id', jobId).eq('user_id', user.id);
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
      certificate_type: 'cp12',
    })
    .eq('id', jobId)
    .eq('user_id', user.id);

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
  await sb.from('cp12_appliances').delete().eq('job_id', input.jobId);

  if (input.appliances.length) {
    const rows = input.appliances.map((appliance) => ({
      job_id: input.jobId,
      user_id: user.id,
      ...appliance,
    }));
    const { data: insData, error: insertErr } = await sb.from('cp12_appliances').insert(rows).select();
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

  await sb.from('jobs').update({ certificate_type: 'cp12' }).eq('id', input.jobId).eq('user_id', user.id);

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

async function renderCp12Pdf({ fieldMap, appliances, issuedAt }: Cp12RenderInput) {
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
    const checkedDate = formatText((app as any).checked_date ?? fieldMap.inspection_date ?? '', '');
    const rowValues = [
      `${index + 1}`,
      formatText(app.location),
      formatText((app as any).appliance_type ?? (app as any).description),
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
    .from('job_fields')
    .upsert(
      { job_id: jobId, field_key: `${role}_signature`, value: url },
      { onConflict: 'job_id,field_key' },
    );
  const { data: job } = await sb.from('jobs').select('certificate_type').eq('id', jobId).maybeSingle();
  const revalidateTarget = job?.certificate_type ? `/wizard/create/${job.certificate_type}?jobId=${jobId}` : `/jobs/${jobId}`;
  revalidatePath(revalidateTarget);
  return { url };
}

const GenerateBoilerPdfSchema = z.object({
  jobId: z.string().uuid(),
  previewOnly: z.boolean().optional().default(false),
});

const GenerateGeneralWorksPdfSchema = z.object({
  jobId: z.string().uuid(),
  previewOnly: z.boolean().optional().default(false),
});

export async function generateBoilerServicePdf(payload: z.infer<typeof GenerateBoilerPdfSchema>) {
  const input = GenerateBoilerPdfSchema.parse(payload);
  const previewOnly = input.previewOnly ?? false;
  const sb = await supabaseServerServiceRole();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  const { data: job, error: jobErr } = await sb.from('jobs').select('user_id').eq('id', input.jobId).maybeSingle();
  if (jobErr) throw new Error(jobErr.message);
  if (!job) throw new Error('Job not found');
  if ((job as any).user_id !== user.id) {
    throw new Error('RLS mismatch: job owner does not match auth user');
  }

  await sb.from('jobs').update({ certificate_type: 'boiler_service' }).eq('id', input.jobId).eq('user_id', user.id);

  const { data: fields, error: fieldsErr } = await sb
    .from('job_fields')
    .select('field_key, value')
    .eq('job_id', input.jobId);
  if (fieldsErr) throw new Error(fieldsErr.message);
  const fieldMap = Object.fromEntries((fields ?? []).map((f) => [f.field_key, f.value ?? null]));

  const issuedAt = new Date().toISOString();
  const validationErrors = previewOnly ? [] : validateBoilerServiceForIssue(fieldMap);
  if (validationErrors.length) {
    throw new Error(`Boiler service validation failed: ${validationErrors.join('; ')}`);
  }

  const pdfBytes = await renderBoilerServicePdf({
    fieldMap,
    issuedAt,
    previewMode: previewOnly,
  });
  const pathBase = previewOnly ? 'boiler-service/previews' : 'boiler-service';
  const path = `${pathBase}/${user.id}/${input.jobId}-${previewOnly ? 'preview' : Date.now()}.pdf`;
  const upload = await sb.storage
    .from('certificates')
    .upload(path, Buffer.from(pdfBytes), { contentType: 'application/pdf', upsert: true });
  if (upload.error || !upload.data?.path) {
    throw new Error(upload.error?.message ?? 'Certificate PDF upload failed');
  }

  if (previewOnly) {
    const { data: signed, error: signedErr } = await sb.storage.from('certificates').createSignedUrl(path, 60 * 10);
    if (signedErr || !signed?.signedUrl) {
      throw new Error(signedErr?.message ?? 'Unable to create signed URL for certificate');
    }
    console.log('BOILER SERVICE PDF preview generated', { jobId: input.jobId, path });
    return { pdfUrl: signed.signedUrl, preview: true };
  }

  const { data: existingCertificate, error: existingCertErr } = await sb
    .from('certificates')
    .select('id, job_id, pdf_path, pdf_url')
    .eq('job_id', input.jobId)
    .maybeSingle();
  if (existingCertErr) throw new Error(existingCertErr.message);

  const basePayload: Record<string, unknown> = { job_id: input.jobId };
  const certificatePayload: Record<string, unknown> = { ...basePayload, pdf_path: path };
  const writeCertificate = (payload: Record<string, unknown>) =>
    existingCertificate
      ? sb.from('certificates').update(payload).eq('job_id', input.jobId)
      : sb.from('certificates').insert(payload);

  const { error: certErr } = await writeCertificate(certificatePayload);
  if (certErr) {
    console.error('BOILER SERVICE certificate write failed (pdf_path)', {
      jobId: input.jobId,
      payload: certificatePayload,
      code: certErr.code,
      message: certErr.message,
    });
    if (certErr.code === '42703') {
      const fallbackPayload: Record<string, unknown> = { ...basePayload, pdf_url: path };
      const { error: fallbackErr } = await writeCertificate(fallbackPayload);
      if (fallbackErr) {
        console.error('BOILER SERVICE certificate write failed (pdf_url fallback)', {
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

  const { data: signed, error: signedErr } = await sb.storage.from('certificates').createSignedUrl(path, 60 * 10);
  if (signedErr || !signed?.signedUrl) {
    throw new Error(signedErr?.message ?? 'Unable to create signed URL for certificate');
  }

  await sb
    .from('job_fields')
    .upsert({ job_id: input.jobId, field_key: 'issued_at', value: issuedAt }, { onConflict: 'job_id,field_key' });
  await sb.from('jobs').update({ status: 'completed', certificate_type: 'boiler_service' }).eq('id', input.jobId).eq('user_id', user.id);
  revalidatePath(`/jobs/${input.jobId}`);
  console.log('BOILER SERVICE certificate stored', { jobId: input.jobId, path });
  return { pdfUrl: signed.signedUrl };
}

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

  const { data: job, error: jobErr } = await supabase.from('jobs').select('user_id').eq('id', input.jobId).maybeSingle();
  if (jobErr) throw new Error(jobErr.message);
  if (!job) throw new Error('Job not found');
  const jobOwnerId = (job as any).user_id ?? null;
  console.log('GW: jobs update (set certificate_type) start', { jobId: input.jobId, jobOwnerId });
  let setTypeQuery = supabase.from('jobs').update({ certificate_type: 'general_works' }).eq('id', input.jobId);
  if (jobOwnerId) {
    setTypeQuery = setTypeQuery.eq('user_id', jobOwnerId);
  }
  const jobTypeRes = await setTypeQuery;
  console.log('GW: jobs update (set certificate_type) result', jobTypeRes);
  if (jobTypeRes.error) throw new Error(jobTypeRes.error.message);

  const { data: fields, error: fieldsErr } = await supabase
    .from('job_fields')
    .select('field_key, value')
    .eq('job_id', input.jobId);
  if (fieldsErr) throw new Error(fieldsErr.message);
  const fieldMap = Object.fromEntries((fields ?? []).map((f) => [f.field_key, f.value ?? null]));

  const { data: photos, error: photosErr } = await supabase
    .from('job_photos')
    .select('category, file_url')
    .eq('job_id', input.jobId);
  if (photosErr) throw new Error(photosErr.message);

  const issuedAt = new Date().toISOString();
  const validationErrors = previewOnly ? [] : validateGeneralWorksForIssue(fieldMap);
  if (validationErrors.length) {
    throw new Error(`General Works validation failed: ${validationErrors.join('; ')}`);
  }

  const pdfBytes = await renderGeneralWorksPdf({
    fieldMap,
    photos: (photos ?? []).filter((p) => p.category && p.file_url) as { category: string; file_url: string }[],
    issuedAt,
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
    return { pdfUrl: signed.signedUrl, preview: true };
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
    .from('job_fields')
    .upsert({ job_id: input.jobId, field_key: 'issued_at', value: issuedAt }, { onConflict: 'job_id,field_key' });
  console.log('GW: job_fields upsert result', issuedAtRes);
  const issuedAtErr = (issuedAtRes as { error?: { code?: string; message: string } }).error;
  if (issuedAtErr) throw new Error(issuedAtErr.message);

  console.log('GW: jobs update (set status completed) start', {
    jobId: input.jobId,
    payload: { status: 'completed', certificate_type: 'general_works' },
  });
  let completeQuery = supabase
    .from('jobs')
    .update({ status: 'completed', certificate_type: 'general_works' })
    .eq('id', input.jobId);
  if (jobOwnerId) {
    completeQuery = completeQuery.eq('user_id', jobOwnerId);
  }
  const jobCompleteRes = await completeQuery;
  console.log('GW: jobs update (set status completed) result', jobCompleteRes);
  if (jobCompleteRes.error) throw new Error(jobCompleteRes.error.message);
  revalidatePath(`/jobs/${input.jobId}`);
  console.log('GENERAL WORKS certificate stored', { jobId: input.jobId, path });
  return { pdfUrl: signed.signedUrl };
}

const GeneratePdfSchema = z.object({
  jobId: z.string().uuid(),
  certificateType: z.enum(CERTIFICATE_TYPES),
  previewOnly: z.boolean().optional().default(false),
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
  const cookieStore = cookies();
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

  const { data: jobRow, error: jobErr } = await sb.from('jobs').select('id, user_id').eq('id', input.jobId).maybeSingle();
  if (jobErr) throw new Error(jobErr.message);
  if (!jobRow || (jobRow as any).user_id !== user.id) {
    throw new Error('RLS mismatch: job owner does not match auth user');
  }

  const { data: existingCertificate, error: existingCertErr } = await sb.from('certificates').select('id, job_id').eq('job_id', input.jobId).maybeSingle();
  if (existingCertErr) throw new Error(existingCertErr.message);
  console.log('CERTIFICATE existing row', { jobId: input.jobId, exists: !!existingCertificate, id: existingCertificate?.id });

  if (input.certificateType === 'boiler_service') {
    return generateBoilerServicePdf({ jobId: input.jobId, previewOnly });
  }

  if (input.certificateType === 'general_works') {
    console.log('GW-PDF generateCertificatePdf dispatch start', { jobId: input.jobId, previewOnly });
    const response = await generateGeneralWorksPdf({ jobId: input.jobId, previewOnly });
    console.log('GW-PDF generateCertificatePdf dispatch result', { jobId: input.jobId, previewOnly });
    return response;
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
    return { pdfUrl };
  }

  const { data: fields, error: fieldsErr } = await sb
    .from('job_fields')
    .select('field_key, value')
    .eq('job_id', input.jobId);
  if (fieldsErr) throw new Error(fieldsErr.message);
  const fieldMap = Object.fromEntries((fields ?? []).map((f) => [f.field_key, f.value ?? null]));

  let appliances: Cp12Appliance[] = [];
  const appResp = await sb.from('cp12_appliances').select('*').eq('job_id', input.jobId);
  if (appResp.error) {
    if (appResp.error.code !== '42P01') throw new Error(appResp.error.message);
  } else if (appResp.data) {
    appliances = appResp.data as Cp12Appliance[];
  }

  const issuedAt = new Date().toISOString();
  const validationErrors = previewOnly ? [] : validateCp12ForIssue(fieldMap, appliances);
  if (validationErrors.length) {
    throw new Error(`CP12 validation failed: ${validationErrors.join('; ')}`);
  }

  const pdfBytes = await renderCp12Pdf({
    fieldMap,
    appliances,
    issuedAt,
  });
  const pathBase = previewOnly ? 'cp12/previews' : 'cp12';
  const path = `${pathBase}/${user.id}/${input.jobId}-${previewOnly ? 'preview' : Date.now()}.pdf`;
  const upload = await sb.storage
    .from('certificates')
    .upload(path, Buffer.from(pdfBytes), { contentType: 'application/pdf', upsert: true });
  if (upload.error || !upload.data?.path) {
    throw new Error(upload.error?.message ?? 'Certificate PDF upload failed');
  }

  if (previewOnly) {
    const { data: signed, error: signedErr } = await sb.storage.from('certificates').createSignedUrl(path, 60 * 10);
    if (signedErr || !signed?.signedUrl) {
      throw new Error(signedErr?.message ?? 'Unable to create signed URL for certificate');
    }
    console.log('CERTIFICATE PDF preview generated', { jobId: input.jobId, path });
    return { pdfUrl: signed.signedUrl, preview: true };
  }

  const baseCertificatePayload: Record<string, unknown> = {
    job_id: input.jobId,
  };
  const certificatePayload: Record<string, unknown> = { ...baseCertificatePayload, pdf_path: path };

  const writeCertificate = (payload: Record<string, unknown>) =>
    existingCertificate
      ? sb.from('certificates').update(payload).eq('job_id', input.jobId)
      : sb.from('certificates').insert(payload);

  const { error: certErr } = await writeCertificate(certificatePayload);
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

  const { data: signed, error: signedErr } = await sb.storage.from('certificates').createSignedUrl(path, 60 * 10);
  if (signedErr || !signed?.signedUrl) {
    throw new Error(signedErr?.message ?? 'Unable to create signed URL for certificate');
  }
  console.log('CERTIFICATE PDF signed URL generated', { jobId: input.jobId, path });

  await sb
    .from('job_fields')
    .upsert({ job_id: input.jobId, field_key: 'issued_at', value: issuedAt }, { onConflict: 'job_id,field_key' });

  await sb.from('jobs').update({ status: 'completed' }).eq('id', input.jobId);
  revalidatePath(`/jobs/${input.jobId}`);
  return { pdfUrl: signed.signedUrl };
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
  if ((job as any).user_id !== user.id) {
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

  const pdfPath = (certificate as any).pdf_path ?? (certificate as any).pdf_url;
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
