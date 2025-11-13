'use server';

import { revalidatePath } from 'next/cache';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { supabaseServer } from '@/lib/supabaseServer';
import type { PostgrestError } from '@supabase/supabase-js';
import { photoPath, reportPath, signaturePath } from '@/lib/storage';
import { getOpenAIClient } from '@/lib/openai';
import type { Database } from '@/lib/database.types';
import type { TemplateItem } from '@/types/template';
import type {
  JobChecklistItem,
  JobPhoto,
  JobSignatures,
  JobReport,
  JobDetailPayload,
} from '@/types/job-detail';

const JobId = z.string().uuid();
const PhotoId = z.string().uuid();

type JobRow = Database['public']['Tables']['jobs']['Row'];
type JobChecklistRow = Database['public']['Tables']['job_checklist']['Row'];
type JobChecklistStatus = JobChecklistRow['status'];
type PhotoRow = Database['public']['Tables']['photos']['Row'];
type SignatureRow = Database['public']['Tables']['signatures']['Row'];
type ReportRow = Database['public']['Tables']['reports']['Row'];
type TemplateRow = Database['public']['Tables']['templates']['Row'];

export async function listJobs() {
  const sb = await supabaseServer();
  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser();
  if (userErr || !user) throw new Error(userErr?.message ?? 'Unauthorized');

  const columnVariants = [
    'id, client_name, address, status, created_at, user_id',
    'id, client_name, address, status, created_at',
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

  const sb = await supabaseServer();
  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser();
  if (userErr || !user) throw new Error(userErr?.message ?? 'Unauthorized');

  const { data: template, error: tmplErr } = await sb
    .from('templates')
    .select('id, name, items, is_public, created_by')
    .eq('id', input.template_id)
    .single();
  if (tmplErr || !template) throw new Error(tmplErr?.message ?? 'Template not found');
  const templateRow = template as TemplateRow;
  const ownerId = templateRow.created_by;
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

  const templateItems = Array.isArray(templateRow.items)
    ? (templateRow.items as unknown as TemplateItem[])
    : [];
  if (templateItems.length) {
    const checklistRows = templateItems.map(
      (item): Database['public']['Tables']['job_checklist']['Insert'] => ({
        job_id: job.id,
        label: String(item.label ?? 'Checklist item'),
        status: 'pending',
        note: null,
        user_id: user.id,
      }),
    );
    const { error: clErr } = await sb.from('job_checklist').insert(checklistRows);
    if (clErr) throw new Error(clErr.message);
  }

  revalidatePath('/dashboard');
  return { jobId: job.id };
}


export async function getJobWithChecklist(jobId: string) {
  JobId.parse(jobId);
  const sb = await supabaseServer();

  const {
    data: { user },
    error: authErr,
  } = await sb.auth.getUser();
  if (authErr || !user) throw new Error(authErr?.message ?? 'Unauthorized');

  const columnVariants = [
    'id, client_name, address, status, created_at, template_id, user_id, notes',
    'id, client_name, address, status, created_at, template_id, user_id',
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
      .from('job_checklist')
      .select('id, job_id, label, status, note, created_at, user_id')
      .eq('job_id', typedJobId)
      .order('created_at', { ascending: true }),
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
    label: item.label ?? 'Checklist item',
    status: (item.status as JobChecklistStatus) ?? 'pending',
    note: item.note ?? null,
    created_at: item.created_at ?? null,
    user_id: item.user_id,
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
      client_name: jobData.client_name ?? null,
      address: jobData.address ?? null,
      status: jobData.status ?? null,
      created_at: jobData.created_at ?? null,
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

export async function updateChecklistItem(params: {
  jobId: string;
  itemId: string;
  status?: JobChecklistStatus;
  note?: string;
}) {
  JobId.parse(params.jobId);
  const sb = await supabaseServer();

  const patch: Record<string, unknown> = {};
  if (params.status) patch.status = params.status;
  if (typeof params.note === 'string') patch.note = params.note.length ? params.note : null;

  if (!Object.keys(patch).length) return;

  const typedItemId = params.itemId as JobChecklistRow['id'];
  const { error } = await sb.from('job_checklist').update(patch).eq('id', typedItemId);
  if (error) throw new Error(error.message);

  revalidatePath(`/jobs/${params.jobId}`);
}

export async function uploadPhoto(params: { jobId: string; itemId: string; file: File; caption?: string }) {
  JobId.parse(params.jobId);
  const sb = await supabaseServer();
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
  const sb = await supabaseServer();
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
  const sb = await supabaseServer();

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

  revalidatePath(`/jobs/${params.jobId}`);
}

export async function generateReport(jobId: string) {
  JobId.parse(jobId);
  const sb = await supabaseServer();
  const typedJobId = jobId as JobRow['id'];

  const detail = await getJobWithChecklist(jobId);

  const checklistSummary = detail.items.map((item) => ({
    label: item.label,
    status: item.status ?? 'pending',
    note: item.note ?? '',
  }));

  const openai = getOpenAIClient();
  let summary = 'Inspection completed.';
  try {
    const completion = await openai.responses.create({
      model: 'gpt-4o-mini',
      input: [
        {
          role: 'system',
          content:
            'You are an assistant producing concise, professional summaries for plumbing inspection reports.',
        },
        {
          role: 'user',
          content: `Summarize these plumbing inspection results in 2–4 professional sentences: ${JSON.stringify(
            checklistSummary,
          )}`,
        },
      ],
    });
    summary = completion.output_text?.trim() || summary;
  } catch (error) {
    console.error('OpenAI summary failed', error);
  }

  const pdfLib = await import('pdf-lib');
  const pdfDoc = await pdfLib.PDFDocument.create();
  const font = await pdfDoc.embedFont(pdfLib.StandardFonts.Helvetica);
  const page = pdfDoc.addPage([595, 842]);
  const { height } = page.getSize();

  let cursorY = height - 60;
  page.drawText('PlumbLog Report', { x: 40, y: cursorY, size: 18, font });
  cursorY -= 30;
  const jobClient = detail.job.client_name ?? 'Client';
  const jobAddress = detail.job.address ?? 'No address provided';
  const createdLabel = detail.job.created_at ? new Date(detail.job.created_at).toLocaleString() : 'Unknown';

  page.drawText(`Client: ${jobClient}`, { x: 40, y: cursorY, size: 12, font });
  cursorY -= 18;
  page.drawText(`Address: ${jobAddress}`, { x: 40, y: cursorY, size: 12, font });
  cursorY -= 18;
  page.drawText(`Created: ${createdLabel}`, { x: 40, y: cursorY, size: 12, font });
  cursorY -= 24;
  page.drawText('Summary', { x: 40, y: cursorY, size: 14, font });
  cursorY -= 18;
  summary.split(/\n|(?<=\.)\s+/).filter(Boolean).forEach((line) => {
    page.drawText(line, { x: 40, y: cursorY, size: 12, font });
    cursorY -= 16;
  });

  cursorY -= 24;
  page.drawText('Checklist', { x: 40, y: cursorY, size: 14, font });
  cursorY -= 18;
  detail.items.forEach((item) => {
    if (cursorY < 80) {
      cursorY = height - 60;
    }
    const statusLabel = (item.status ?? 'pending').toUpperCase();
    page.drawText(`${item.label} — ${statusLabel}`, { x: 40, y: cursorY, size: 12, font });
    cursorY -= 16;
    if (item.note) {
      page.drawText(`Note: ${item.note}`, { x: 60, y: cursorY, size: 11, font });
      cursorY -= 16;
    }
  });

  const embedImage = async (bucket: 'photos' | 'signatures', path: string) => {
    const { data } = await sb.storage.from(bucket).createSignedUrl(path, 60 * 60);
    if (!data?.signedUrl) return null;
    const response = await fetch(data.signedUrl);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    try {
      return await pdfDoc.embedPng(buffer);
    } catch {
      return await pdfDoc.embedJpg(buffer);
    }
  };

  const photoRows = detail.photos;
  if (photoRows.length) {
    const photoPage = pdfDoc.addPage([595, 842]);
    let x = 40;
    let y = 780;
    photoPage.drawText('Photos', { x, y, size: 16, font });
    y -= 40;

    for (const photo of photoRows) {
      const image = await embedImage('photos', photo.storage_path);
      if (!image) continue;
      const dims = image.scaleToFit(160, 120);
      photoPage.drawImage(image, { x, y: y - dims.height, width: dims.width, height: dims.height });
      x += 180;
      if (x > 440) {
        x = 40;
        y -= 140;
        if (y < 120) {
          y = 780;
          photoPage.drawText('Photos (cont.)', { x, y, size: 16, font });
          y -= 40;
        }
      }
    }
  }

  const signatureRows = [];
  if (detail.signatures?.plumber_sig_path) {
    signatureRows.push({ label: 'Plumber', path: detail.signatures.plumber_sig_path });
  }
  if (detail.signatures?.client_sig_path) {
    signatureRows.push({ label: 'Client', path: detail.signatures.client_sig_path });
  }

  if (signatureRows.length) {
    const sigPage = pdfDoc.addPage([595, 400]);
    let y = 360;
    sigPage.drawText('Signatures', { x: 40, y, size: 16, font });
    y -= 40;

    for (const signature of signatureRows) {
      const image = await embedImage('signatures', signature.path);
      if (!image) continue;
      const dims = image.scaleToFit(200, 120);
      sigPage.drawText(signature.label, { x: 40, y, size: 12, font });
      sigPage.drawImage(image, {
        x: 40,
        y: y - dims.height - 10,
        width: dims.width,
        height: dims.height,
      });
      y -= dims.height + 60;
    }
  }

  const pdfBytes = await pdfDoc.save();
  const storagePath = reportPath(jobId);
  const { error: uploadErr } = await sb.storage.from('reports').upload(storagePath, pdfBytes, {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (uploadErr) throw new Error(uploadErr.message);

  const { error: upsertErr } = await sb
    .from('reports')
    .upsert({ job_id: jobId as ReportRow['job_id'], storage_path: storagePath, generated_at: new Date().toISOString() }, { onConflict: 'job_id' });
  if (upsertErr) throw new Error(upsertErr.message);

  await sb.from('jobs').update({ status: 'completed', notes: summary }).eq('id', typedJobId);

  revalidatePath('/dashboard');
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/reports/${jobId}`);

  const { data: signed, error: signedErr } = await sb.storage.from('reports').createSignedUrl(storagePath, 60 * 60 * 24);
  if (signedErr || !signed?.signedUrl) throw new Error(signedErr?.message ?? 'Unable to create report link');

  return { storagePath, signedUrl: signed.signedUrl };
}

export async function createReportSignedUrl(jobId: string) {
  JobId.parse(jobId);
  const sb = await supabaseServer();
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
