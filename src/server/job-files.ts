'use server';

import { supabaseServerAction } from '@/lib/supabaseServer';

export type UploadJobFileInput = {
  jobId: string;
  applianceId?: string | null;
  kind: 'fga_report' | 'fga_screenshot' | 'other';
  file: File;
};

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);

function sanitizeFileName(name: string) {
  const cleaned = name.replace(/[^A-Za-z0-9._-]/g, '_').replace(/_+/g, '_').trim();
  return cleaned.length ? cleaned : 'upload';
}

function isAllowedMimeType(type: string) {
  if (!type) return false;
  if (ALLOWED_MIME_TYPES.has(type)) return true;
  return type.startsWith('image/');
}

export async function uploadJobFile(input: UploadJobFileInput): Promise<{
  id: string;
  storage_path: string;
  kind: string;
  file_name: string;
  mime_type: string;
  created_at: string;
  job_id: string;
  appliance_id: string | null;
}> {
  const sb = await supabaseServerAction();
  const {
    data: { user },
    error: authErr,
  } = await sb.auth.getUser();
  if (authErr || !user) throw new Error(authErr?.message ?? 'Unauthorized');

  // job_files table is newly added and not in generated types; use an untyped handle.
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

  if (!input.file) throw new Error('File is required');
  if (input.file.size > MAX_FILE_SIZE_BYTES) throw new Error('File exceeds 10MB limit');
  if (!isAllowedMimeType(input.file.type)) throw new Error('Unsupported file type');

  const applianceId = input.applianceId?.trim() ? input.applianceId : null;
  const sanitizedFileName = sanitizeFileName(input.file.name);
  const path = `jobs/${input.jobId}/fga/${applianceId ?? 'none'}/${Date.now()}-${sanitizedFileName}`;

  const bytes = await input.file.arrayBuffer();
  const { error: uploadErr } = await sb.storage.from('job-files').upload(path, Buffer.from(bytes), {
    contentType: input.file.type,
    upsert: false,
  });
  if (uploadErr) throw new Error(uploadErr.message);

  const { data: insertRow, error: insertErr } = await anySb
    .from('job_files')
    .insert({
      job_id: input.jobId,
      appliance_id: applianceId,
      kind: input.kind,
      file_name: input.file.name,
      mime_type: input.file.type,
      storage_path: path,
    })
    .select('id, storage_path, kind, file_name, mime_type, created_at, job_id, appliance_id')
    .single();
  if (insertErr) throw new Error(insertErr.message);

  return insertRow;
}

const UUID_MATCH = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function extractJobIdFromPath(path: string) {
  const jobsPrefixMatch = path.match(/jobs\/([0-9a-f-]{36})/i);
  if (jobsPrefixMatch?.[1]) return jobsPrefixMatch[1];
  const anyUuid = path.match(UUID_MATCH);
  return anyUuid?.[0] ?? null;
}

async function assertOwnsJob(sb: Awaited<ReturnType<typeof supabaseServerAction>>, jobId: string, userId: string) {
  const { data: job, error } = await sb.from('jobs').select('id').eq('id', jobId).eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!job) throw new Error('Unauthorized');
}

export async function getSignedJobFileUrl({
  bucket,
  path,
  expiresIn,
}: {
  bucket: string;
  path: string;
  expiresIn: number;
}) {
  const sb = await supabaseServerAction();
  const {
    data: { user },
    error: authErr,
  } = await sb.auth.getUser();
  if (authErr || !user) throw new Error(authErr?.message ?? 'Unauthorized');

  // job_files/reports tables are new; use an untyped handle for lookups.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anySb = sb as any;

  if (!bucket || !path) throw new Error('Bucket and path are required');

  let jobId = extractJobIdFromPath(path);

  if (!jobId) {
    if (bucket === 'job-files') {
      const { data, error } = await anySb.from('job_files').select('job_id').eq('storage_path', path).maybeSingle();
      if (error) throw new Error(error.message);
      jobId = data?.job_id ?? null;
    } else if (bucket === 'reports') {
      const { data, error } = await anySb.from('reports').select('job_id').eq('storage_path', path).maybeSingle();
      if (error) throw new Error(error.message);
      jobId = data?.job_id ?? null;
    } else if (bucket === 'certificates') {
      const { data, error } = await sb
        .from('certificates')
        .select('job_id')
        .or(`pdf_path.eq.${path},pdf_url.eq.${path}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      jobId = data?.job_id ?? null;
    }
  }

  if (!jobId) throw new Error('Unable to resolve job');
  await assertOwnsJob(sb, jobId, user.id);

  const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Unable to create signed URL');
  return data.signedUrl;
}
