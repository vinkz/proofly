'use server';

import { revalidatePath } from 'next/cache';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { supabaseServerAction, supabaseServerReadOnly, supabaseServerServiceRole } from '@/lib/supabaseServer';
import type { PostgrestError } from '@supabase/supabase-js';
import { photoPath, reportPath, signaturePath } from '@/lib/storage';
import type { Database } from '@/lib/database.types';
import type { TemplateItem, TemplateModel } from '@/types/template';
import type {
  JobChecklistItem,
  JobPhoto,
  JobSignatures,
  JobReport,
  JobDetailPayload,
} from '@/types/job-detail';
import type { JobWizardState, ClientSummary } from '@/types/job-wizard';
import { generateReport as aiGenerateReport, generatePDF, type PdfAsset } from '@/lib/reporting';

const JobId = z.string().uuid();
const PhotoId = z.string().uuid();
const ClientId = z.string().uuid();
const TemplateId = z.string().uuid();
const JobDetailsSchema = z.object({
  title: z.string().min(3, 'Title is required'),
  scheduled_for: z.string().min(3, 'Select a scheduled date'),
  technician_name: z.string().min(2, 'Technician required'),
  notes: z.string().optional(),
});
const ReportEmailSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

type JobRow = Database['public']['Tables']['jobs']['Row'];
type JobChecklistRow = Database['public']['Tables']['job_items']['Row'];
type JobChecklistResult = JobChecklistRow['result'];
type PhotoRow = Database['public']['Tables']['photos']['Row'];
type SignatureRow = Database['public']['Tables']['signatures']['Row'];
type ReportRow = Database['public']['Tables']['reports']['Row'];
type TemplateRow = Database['public']['Tables']['templates']['Row'];
type ClientRow = Database['public']['Tables']['clients']['Row'];
type ReportDeliveryRow = Database['public']['Tables']['report_deliveries']['Row'];
const CLIENT_TABLES = ['clients', 'contacts'] as const;
type ClientLike = {
  id: string;
  name: string;
  organization: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  user_id: string | null;
};

const jobColumns =
  'id, client_id, client_name, address, status, created_at, template_id, user_id, notes, title, scheduled_for, completed_at, engineer_signature_path, client_signature_path, technician_name';
const parseTemplateItems = (items: TemplateRow['items']): TemplateItem[] =>
  Array.isArray(items) ? (items as unknown as TemplateItem[]) : [];
const templateFromRow = (row: TemplateRow): TemplateModel => ({
  id: row.id,
  name: row.name,
  trade_type: row.trade_type,
  is_public: !!row.is_public,
  is_general: !!(row as { is_general?: boolean }).is_general,
  user_id: (row as { user_id?: string | null }).user_id ?? (row as { created_by?: string | null }).created_by ?? null,
  description: (row as { description?: string | null }).description ?? null,
  created_at: row.created_at,
  updated_at: row.updated_at ?? null,
  items: parseTemplateItems(row.items),
});

async function requireUser(options: { write?: boolean } = {}) {
  const sb = options.write ? await supabaseServerAction() : await supabaseServerReadOnly();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');
  return { sb, user };
}

async function fetchOwnedJob(jobId: string, options?: { write?: boolean }) {
  const { sb, user } = await requireUser(options);
  const typedJobId = jobId as JobRow['id'];
  const { data, error } = await sb.from('jobs').select(jobColumns).eq('id', typedJobId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Job not found');
  if (data.user_id && data.user_id !== user.id) throw new Error('Unauthorized');
  return { sb, user, job: data };
}

export async function listJobs() {
  const sb = await supabaseServerReadOnly();
  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser();
  if (userErr || !user) throw new Error(userErr?.message ?? 'Unauthorized');

  const columnVariants = [
    'id, client_name, address, status, created_at, user_id, scheduled_for, title, technician_name, template_id, completed_at, engineer_signature_path, client_signature_path',
    'id, client_name, address, status, created_at, user_id',
  ];

  let rows: Record<string, unknown>[] = [];
  let lastErr: PostgrestError | null = null;

  for (const columns of columnVariants) {
    const response = await sb.from('jobs').select(columns).order('created_at', { ascending: false });
    if (response.error) {
      lastErr = response.error;
      if (response.error.code === '42703') continue;
      throw new Error(response.error.message);
    }
    const data = response.data as unknown;
    rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
    break;
  }

  if (!rows.length && lastErr) {
    throw new Error(lastErr.message);
  }

  const filtered = rows.filter((job) => {
    const owner = (job as { user_id?: string | null }).user_id;
    return !owner || owner === user.id;
  });

  return {
    active: filtered.filter((job) => job.status !== 'completed'),
    completed: filtered.filter((job) => job.status === 'completed'),
  };
}

export async function createJob(form: FormData | Record<string, unknown>) {
  const schema = z.object({
    client_name: z.string().min(2),
    address: z.string().min(3),
    template_id: z.string().uuid(),
  });

  const input =
    form instanceof FormData
      ? schema.parse({
          client_name: form.get('client_name'),
          address: form.get('address'),
          template_id: form.get('template_id'),
        })
      : schema.parse(form);

  const sb = await supabaseServerServiceRole();
  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser();
  if (userErr || !user) throw new Error(userErr?.message ?? 'Unauthorized');

  const { data: template, error: tmplErr } = await sb
    .from('templates')
    .select('id, name, items, is_public, is_general, user_id')
    .eq('id', input.template_id)
    .single();
  if (tmplErr || !template) throw new Error(tmplErr?.message ?? 'Template not found');
  const templateRow = template as TemplateRow;
  const ownerId = (templateRow as { user_id?: string | null }).user_id ?? null;
  const isPublic = templateRow.is_public ?? false;
  if (!isPublic && ownerId !== user.id) {
    throw new Error('You do not have access to this template');
  }

  const { data: job, error: jobErr } = await sb
    .from('jobs')
    .insert({
      client_name: input.client_name,
      address: input.address,
      status: 'active',
      template_id: templateRow.id,
      user_id: user.id,
    })
    .select('id')
    .single();
  if (jobErr || !job) throw new Error(jobErr?.message ?? 'Failed to create job');

  const templateItems = parseTemplateItems(templateRow.items);
  if (templateItems.length) {
    const checklistRows = templateItems.map(
      (item): Database['public']['Tables']['job_items']['Insert'] => ({
        job_id: job.id,
        template_item_id: item.id ?? null,
        label: String(item.label ?? 'Checklist item'),
        result: 'pending',
        note: null,
        position: null,
        photos: null,
      }),
    );
    const { error: clErr } = await sb.from('job_items').insert(checklistRows);
    if (clErr) throw new Error(clErr.message);
  }

  revalidatePath('/dashboard');
  return { jobId: job.id };
}

export async function createJobDraftFromClient(clientId: string) {
  ClientId.parse(clientId);
  const sb = await supabaseServerServiceRole();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  const clientRecord = await fetchClientForJob(sb, clientId);
  if (!clientRecord) throw new Error('Client not found');
  if (clientRecord.user_id && clientRecord.user_id !== user.id) throw new Error('Unauthorized');

  const { data: job, error: jobErr } = await sb
    .from('jobs')
    .insert({
      client_id: clientRecord.id,
      client_name: clientRecord.name,
      address: clientRecord.address,
      status: 'draft',
      user_id: user.id,
      title: `${clientRecord.name} inspection`,
    })
    .select('id')
    .single();
  if (jobErr || !job) throw new Error(jobErr?.message ?? 'Could not start job');

  revalidatePath('/jobs');
  return { jobId: job.id };
}


export async function getJobWithChecklist(jobId: string) {
  JobId.parse(jobId);
  const sb = await supabaseServerReadOnly();

  const {
    data: { user },
    error: authErr,
  } = await sb.auth.getUser();
  if (authErr || !user) throw new Error(authErr?.message ?? 'Unauthorized');

  const columnVariants = [
    'id, client_id, client_name, address, status, created_at, template_id, user_id, notes, title, scheduled_for, completed_at, engineer_signature_path, client_signature_path, technician_name',
    'id, client_name, address, status, created_at, template_id, user_id, notes',
  ];

  let job: Record<string, unknown> | null = null;
  let jobErr: PostgrestError | null = null;

  const typedJobId = jobId as JobRow['id'];

  for (const columns of columnVariants) {
    const response = await sb.from('jobs').select(columns).eq('id', typedJobId).maybeSingle();
    if (response.error) {
      jobErr = response.error;
      if (response.error.code === '42703') continue;
      throw new Error(response.error.message);
    }
    const data = response.data as unknown;
    job = data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
    if (job) break;
  }

  if (!job) throw new Error(jobErr?.message ?? 'Job not found');
  const jobOwner = (job as { user_id?: string | null }).user_id;
  if (jobOwner && jobOwner !== user.id) throw new Error('Unauthorized');

  const notes = (job as { notes?: string | null }).notes ?? null;

  const [{ data: items, error: itemsErr }, { data: photos, error: photosErr }] = await Promise.all([
    sb
      .from('job_items')
      .select('id, job_id, template_item_id, label, result, note, photos, position')
      .eq('job_id', typedJobId)
      .order('position', { ascending: true }),
    sb
      .from('photos')
      .select('id, job_id, checklist_id, storage_path, caption, created_at')
      .eq('job_id', typedJobId)
      .order('created_at', { ascending: true }),
  ]);
  if (itemsErr) throw new Error(itemsErr.message);
  if (photosErr) throw new Error(photosErr.message);

  const { data: sig, error: sigErr } = await sb
    .from('signatures')
    .select('plumber_sig_path, client_sig_path, signed_at')
    .eq('job_id', typedJobId)
    .maybeSingle();
  if (sigErr) throw new Error(sigErr.message);

  const { data: rep, error: repErr } = await sb
    .from('reports')
    .select('storage_path, generated_at')
    .eq('job_id', typedJobId)
    .maybeSingle();
  if (repErr) throw new Error(repErr.message);

  const checklistItems: JobChecklistItem[] = (items ?? []).map((item) => ({
    id: item.id,
    job_id: (item.job_id ?? jobId) as string,
    template_item_id: item.template_item_id ?? null,
    label: item.label ?? 'Checklist item',
    result: (item.result as JobChecklistResult) ?? 'pending',
    note: item.note ?? null,
    photos: (Array.isArray(item.photos) ? item.photos : null) as string[] | null,
    position: typeof item.position === 'number' ? item.position : null,
  }));

  const photoItems: JobPhoto[] = (photos ?? []).map((photo) => ({
    id: photo.id,
    job_id: (photo.job_id ?? jobId) as string,
    checklist_id: photo.checklist_id,
    storage_path: photo.storage_path,
    caption: photo.caption ?? null,
    created_at: photo.created_at ?? null,
  }));

  const signatures: JobSignatures | null = sig
    ? {
        plumber_sig_path: sig.plumber_sig_path ?? null,
        client_sig_path: sig.client_sig_path ?? null,
        signed_at: sig.signed_at ?? null,
      }
    : null;

  const report: JobReport | null = rep
    ? {
        storage_path: rep.storage_path,
        generated_at: rep.generated_at ?? null,
      }
    : null;

  const jobData = job as JobRow;

  const payload: JobDetailPayload = {
    job: {
      id: jobData.id,
      client_id: jobData.client_id ?? null,
      client_name: jobData.client_name ?? null,
      address: jobData.address ?? null,
      title: jobData.title ?? null,
      status: jobData.status ?? null,
      created_at: jobData.created_at ?? null,
      scheduled_for: jobData.scheduled_for ?? null,
      completed_at: (job as { completed_at?: string | null }).completed_at ?? null,
      engineer_signature_path: (job as { engineer_signature_path?: string | null }).engineer_signature_path ?? null,
      client_signature_path: (job as { client_signature_path?: string | null }).client_signature_path ?? null,
      technician_name: jobData.technician_name ?? null,
      template_id: jobData.template_id ?? null,
      user_id: jobOwner ?? null,
      notes,
    },
    items: checklistItems,
    photos: photoItems,
    signatures,
    report,
  };

  return payload;
}

export async function setJobTemplate(jobId: string, templateId: string) {
  JobId.parse(jobId);
  TemplateId.parse(templateId);
  const sb = await supabaseServerServiceRole();
  const { sb: ownerClient, user, job } = await fetchOwnedJob(jobId, { write: false });

  const typedTemplateId = templateId as TemplateRow['id'];
  const { data: template, error: tmplErr } = await sb
    .from('templates')
    .select('id, name, trade_type, description, is_public, is_general, user_id, items')
    .eq('id', typedTemplateId)
    .maybeSingle();
  if (tmplErr) throw new Error(tmplErr.message);
  if (!template) throw new Error('Template not found');

  const templateOwner =
    (template as { user_id?: string | null }).user_id ?? (template as { created_by?: string | null }).created_by ?? null;
  const isOwner = templateOwner === user.id;
  if (!template.is_public && !isOwner) throw new Error('You do not have access to that template');

  const templateItems = parseTemplateItems(template.items);
  const typedJobId = jobId as NonNullable<JobChecklistRow['job_id']>;

  await sb.from('job_items').delete().eq('job_id', typedJobId);

  if (templateItems.length) {
    const checklistRows = templateItems.map(
      (item, index): Database['public']['Tables']['job_items']['Insert'] => ({
        job_id: typedJobId,
        template_item_id: item.id ?? null,
        label: item.label ?? 'Checklist item',
        result: 'pending',
        note: null,
        position: index,
        photos: null,
      }),
    );
    const { error: insertErr } = await sb.from('job_items').insert(checklistRows);
    if (insertErr) throw new Error(insertErr.message);
  }

  const { error: updateErr } = await sb
    .from('jobs')
    .update({ template_id: template.id, status: job.status === 'draft' ? 'draft' : job.status })
    .eq('id', jobId as JobRow['id']);
  if (updateErr) throw new Error(updateErr.message);

  revalidatePath(`/jobs/new/${jobId}/template`);
  return { jobId, items: templateItems.length };
}

export async function saveJobDetails(jobId: string, form: FormData | Record<string, unknown>) {
  JobId.parse(jobId);
  const payload =
    form instanceof FormData
      ? JobDetailsSchema.parse({
          title: form.get('title'),
          scheduled_for: form.get('scheduled_for'),
          technician_name: form.get('technician_name'),
          notes: form.get('notes') ?? undefined,
        })
      : JobDetailsSchema.parse(form);

  const { sb } = await fetchOwnedJob(jobId, { write: true });
  const typedJobId = jobId as JobRow['id'];
  const { error } = await sb
    .from('jobs')
    .update({
      title: payload.title,
      scheduled_for: payload.scheduled_for,
      technician_name: payload.technician_name,
      notes: payload.notes ?? null,
      status: 'active',
    })
    .eq('id', typedJobId);
  if (error) throw new Error(error.message);

  revalidatePath(`/jobs/new/${jobId}/details`);
}

export async function getJobWizardState(jobId: string): Promise<JobWizardState> {
  const detail = await getJobWithChecklist(jobId);
  const sb = await supabaseServerReadOnly();

  const [clientRecord, templateRow] = await Promise.all([
    detail.job.client_id ? fetchClientForJob(sb, detail.job.client_id) : Promise.resolve(null),
    detail.job.template_id
      ? sb
          .from('templates')
          .select('id, name, trade_type, description, is_public, is_general, user_id, created_at, updated_at, items')
          .eq('id', detail.job.template_id as TemplateRow['id'])
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (templateRow?.error) throw new Error(templateRow.error.message);

  const client: ClientSummary | null = clientRecord
    ? {
        id: clientRecord.id,
        name: clientRecord.name,
        organization: clientRecord.organization,
        email: clientRecord.email,
        phone: clientRecord.phone,
        address: clientRecord.address,
      }
    : null;

  const template = templateRow?.data ? templateFromRow(templateRow.data as TemplateRow) : null;

  return { ...detail, client, template };
}

export async function updateChecklistItem(params: {
  jobId: string;
  itemId: string;
  result?: JobChecklistResult;
  note?: string;
}) {
  JobId.parse(params.jobId);
  const sb = await supabaseServerServiceRole();

  const patch: Record<string, unknown> = {};
  if (params.result) patch.result = params.result;
  if (typeof params.note === 'string') patch.note = params.note.length ? params.note : null;

  if (!Object.keys(patch).length) return;

  const typedItemId = params.itemId as JobChecklistRow['id'];
  const { error } = await sb.from('job_items').update(patch).eq('id', typedItemId);
  if (error) throw new Error(error.message);

  revalidatePath(`/jobs/${params.jobId}`);
}

export async function uploadPhoto(params: { jobId: string; itemId: string; file: File; caption?: string }) {
  JobId.parse(params.jobId);
  const sb = await supabaseServerServiceRole();
  const typedJobId = params.jobId as PhotoRow['job_id'];

  const bytes = await params.file.arrayBuffer();
  const extension = params.file.name.split('.').pop() ?? 'jpg';
  const filename = `${randomUUID()}.${extension}`;
  const path = photoPath(params.jobId, params.itemId, filename);

  const { error: uploadErr } = await sb.storage.from('photos').upload(path, Buffer.from(bytes), {
    contentType: params.file.type || 'image/jpeg',
    upsert: false,
  });
  if (uploadErr) throw new Error(uploadErr.message);

  const { error: insertErr } = await sb.from('photos').insert({
    job_id: typedJobId,
    checklist_id: params.itemId,
    storage_path: path,
    caption: params.caption ?? null,
  });
  if (insertErr) throw new Error(insertErr.message);

  revalidatePath(`/jobs/${params.jobId}`);
}

export async function deletePhoto(params: { jobId: string; photoId: string; storagePath: string }) {
  JobId.parse(params.jobId);
  PhotoId.parse(params.photoId);
  const sb = await supabaseServerServiceRole();
  const typedJobId = params.jobId as JobRow['id'];
  const typedPhotoId = params.photoId as PhotoRow['id'];

  const {
    data: { user },
    error: authErr,
  } = await sb.auth.getUser();
  if (authErr || !user) throw new Error(authErr?.message ?? 'Unauthorized');

  const { data: jobRecord, error: jobErr } = await sb.from('jobs').select('user_id').eq('id', typedJobId).maybeSingle();
  if (jobErr) throw new Error(jobErr.message);
  const ownerId = jobRecord?.user_id;
  if (ownerId && ownerId !== user.id) throw new Error('Unauthorized');

  const { error: storageErr } = await sb.storage.from('photos').remove([params.storagePath]);
  if (storageErr) throw new Error(storageErr.message);

  const { error: deleteErr } = await sb.from('photos').delete().eq('id', typedPhotoId);
  if (deleteErr) throw new Error(deleteErr.message);

  revalidatePath(`/jobs/${params.jobId}`);
}

export async function saveSignatures(params: { jobId: string; plumber?: string | null; client?: string | null }) {
  JobId.parse(params.jobId);
  const sb = await supabaseServerServiceRole();

  const toBuffer = (dataUrl: string) => Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');

  const plumberPath = params.plumber ? signaturePath(params.jobId, 'plumber') : null;
  const clientPath = params.client ? signaturePath(params.jobId, 'client') : null;

  const uploads: Array<Promise<void>> = [];

  if (plumberPath && params.plumber) {
    uploads.push(
      (async () => {
        const { error } = await sb.storage
          .from('signatures')
          .upload(plumberPath, toBuffer(params.plumber!), { contentType: 'image/png', upsert: true });
        if (error) throw new Error(error.message);
      })(),
    );
  }

  if (clientPath && params.client) {
    uploads.push(
      (async () => {
        const { error } = await sb.storage
          .from('signatures')
          .upload(clientPath, toBuffer(params.client!), { contentType: 'image/png', upsert: true });
        if (error) throw new Error(error.message);
      })(),
    );
  }

  if (!uploads.length) return;

  await Promise.all(uploads);

  const { data: existing } = await sb
    .from('signatures')
    .select('plumber_sig_path, client_sig_path')
    .eq('job_id', params.jobId as SignatureRow['job_id'])
    .maybeSingle();

  const payload = {
    job_id: params.jobId,
    plumber_sig_path: plumberPath ?? existing?.plumber_sig_path ?? null,
    client_sig_path: clientPath ?? existing?.client_sig_path ?? null,
    signed_at: new Date().toISOString(),
  };

  const { error: upsertErr } = await sb.from('signatures').upsert(payload, { onConflict: 'job_id' });
  if (upsertErr) throw new Error(upsertErr.message);

  const plumberSigned = !!payload.plumber_sig_path;
  const clientSigned = !!payload.client_sig_path;
  const nextStatus = plumberSigned && clientSigned ? 'awaiting_report' : 'awaiting_signatures';

  await sb
    .from('jobs')
    .update({ status: nextStatus })
    .eq('id', params.jobId as JobRow['id']);

  revalidatePath(`/jobs/${params.jobId}`);
  revalidatePath(`/jobs/new/${params.jobId}/summary`);
}

export async function deleteJob(jobId: string) {
  JobId.parse(jobId);
  const sb = await supabaseServerServiceRole();

  const { error } = await sb.from('jobs').delete().eq('id', jobId as JobRow['id']);
  if (error) throw new Error(error.message);

  revalidatePath('/dashboard');
  revalidatePath('/jobs');
}

export async function finalizeJobReport(jobId: string) {
  JobId.parse(jobId);
  const sb = await supabaseServerServiceRole();
  const typedJobId = jobId as JobRow['id'];
  const detail = await getJobWithChecklist(jobId);

  const jobPayload = {
    id: detail.job.id,
    title: detail.job.title,
    client_name: detail.job.client_name,
    address: detail.job.address,
    scheduled_for: detail.job.scheduled_for,
    technician_name: detail.job.technician_name,
  };

  const summary = await aiGenerateReport({
    job: jobPayload,
    checklist: detail.items,
  });

  const itemMap = new Map(detail.items.map((item) => [item.id, item.label]));

  const loadAsset = async (bucket: 'photos' | 'signatures', path: string): Promise<PdfAsset | null> => {
    const { data } = await sb.storage.from(bucket).createSignedUrl(path, 60 * 60);
    if (!data?.signedUrl) return null;
    const response = await fetch(data.signedUrl);
    if (!response.ok) return null;
    const buffer = new Uint8Array(await response.arrayBuffer());
    const header = response.headers.get('content-type') ?? 'image/jpeg';
    const mime: PdfAsset['mimeType'] = header.includes('png') ? 'image/png' : 'image/jpeg';
    return { kind: bucket === 'photos' ? 'photo' : 'signature', label: 'Asset', data: buffer, mimeType: mime };
  };

  const assets: PdfAsset[] = [];
  for (const photo of detail.photos) {
    const asset = await loadAsset('photos', photo.storage_path);
    if (!asset) continue;
    const label =
      photo.caption ?? (photo.checklist_id ? itemMap.get(photo.checklist_id) ?? 'Checklist Photo' : 'Photo');
    assets.push({ ...asset, label });
  }

  if (detail.signatures?.plumber_sig_path) {
    const asset = await loadAsset('signatures', detail.signatures.plumber_sig_path);
    if (asset) {
      assets.push({ ...asset, kind: 'signature', label: 'Engineer signature' });
    }
  }
  if (detail.signatures?.client_sig_path) {
    const asset = await loadAsset('signatures', detail.signatures.client_sig_path);
    if (asset) {
      assets.push({ ...asset, kind: 'signature', label: 'Client signature' });
    }
  }

  const pdfBytes = await generatePDF({
    job: jobPayload,
    summary,
    checklist: detail.items,
    assets,
  });

  const storagePath = reportPath(jobId);
  const { error: uploadErr } = await sb.storage.from('reports').upload(storagePath, pdfBytes, {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (uploadErr) throw new Error(uploadErr.message);

  await sb.from('reports').delete().eq('job_id', typedJobId);
  const { error: insertReportErr } = await sb
    .from('reports')
    .insert({
      job_id: jobId as ReportRow['job_id'],
      storage_path: storagePath,
      generated_at: new Date().toISOString(),
    });
  if (insertReportErr) throw new Error(insertReportErr.message);

  await sb.from('jobs').update({ status: 'completed', notes: summary }).eq('id', typedJobId);

  revalidatePath('/dashboard');
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/reports/${jobId}`);
  revalidatePath(`/jobs/new/${jobId}/ai`);

  const { data: signed, error: signedErr } = await sb.storage.from('reports').createSignedUrl(storagePath, 60 * 60 * 24);
  if (signedErr || !signed?.signedUrl) throw new Error(signedErr?.message ?? 'Unable to create report link');

  return { storagePath, signedUrl: signed.signedUrl, summary };
}

export async function createReportSignedUrl(jobId: string) {
  JobId.parse(jobId);
  const sb = await supabaseServerServiceRole();
  const typedJobId = jobId as ReportRow['job_id'];

  const { data: report, error } = await sb
    .from('reports')
    .select('storage_path')
    .eq('job_id', typedJobId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!report?.storage_path) throw new Error('Report not found');

  const { data, error: signedErr } = await sb.storage.from('reports').createSignedUrl(report.storage_path, 60 * 60 * 24 * 7);
  if (signedErr || !data?.signedUrl) throw new Error(signedErr?.message ?? 'Unable to create link');

  return data.signedUrl;
}

export async function sendReportEmail(jobId: string, payload: FormData | Record<string, unknown>) {
  JobId.parse(jobId);
  const body =
    payload instanceof FormData
      ? ReportEmailSchema.parse({
          email: payload.get('email'),
          name: payload.get('name') ?? undefined,
        })
      : ReportEmailSchema.parse(payload);

  const sb = await supabaseServerServiceRole();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  const { data: report, error: reportErr } = await sb
    .from('reports')
    .select('id, storage_path')
    .eq('job_id', jobId as ReportRow['job_id'])
    .maybeSingle();
  if (reportErr) throw new Error(reportErr.message);
  if (!report?.storage_path) throw new Error('Generate a report before sending');

  const { error: insertErr } = await sb.from('report_deliveries').insert({
    job_id: jobId as ReportDeliveryRow['job_id'],
    report_id: report.id as ReportDeliveryRow['report_id'],
    recipient_email: body.email,
    recipient_name: body.name ?? null,
    status: 'queued',
  });
  if (insertErr) throw new Error(insertErr.message);

  revalidatePath(`/reports/${jobId}`);
  return { ok: true };
}
async function fetchClientForJob(
  sb:
    | Awaited<ReturnType<typeof supabaseServerReadOnly>>
    | Awaited<ReturnType<typeof supabaseServerAction>>
    | Awaited<ReturnType<typeof supabaseServerServiceRole>>,
  clientId: string,
) {
  let lastErr: PostgrestError | null = null;
  for (const table of CLIENT_TABLES) {
    const columns =
      table === 'clients'
        ? 'id, name, organization, email, phone, address, user_id'
        : 'id, name, email, phone, address, user_id';
    const { data, error } = await (sb as any)
      .from(table)
      .select(columns)
      .eq('id', clientId)
      .maybeSingle();
    if (error) {
      if (error.code === '42P01') {
        lastErr = error;
        continue;
      }
      throw new Error(error.message);
    }
    if (!data) continue;
    return {
      id: data.id,
      name: data.name,
      organization: table === 'clients' ? data.organization ?? null : null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      address: data.address ?? null,
      user_id: data.user_id ?? null,
    } as ClientLike;
  }
  if (lastErr) throw new Error(lastErr.message);
  return null;
}
