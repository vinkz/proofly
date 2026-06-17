'use server';

import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';
import { supabaseServerServiceRole } from '@/lib/supabaseServer';
import { deriveNextDueFromCertificates, normalizePublicDateOnly } from '@/lib/public-compliance';
import { CERTIFICATE_LABELS, type CertificateType } from '@/types/certificates';
import { ensureRenewalJobForSource, normalizeDateOnly, notifyEngineerOfRenewalResponse } from './renewal-confirm';

const PublicTokenSchema = z.string().min(16).max(128).regex(/^[a-zA-Z0-9_-]+$/);
const RenewalRequestSchema = z.object({
  token: PublicTokenSchema,
  tenantName: z.string().max(120).optional().default(''),
  tenantPhone: z.string().max(80).optional().default(''),
  accessNotes: z.string().max(1000).optional().default(''),
  preferredDates: z.string().max(500).optional().default(''),
  preferredDate: z.string().max(20).optional().default(''),
});

const pickText = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return '';
};

export type PropertyVaultData = {
  token: string;
  propertyId: string;
  address: string;
  name: string | null;
  landlordName: string | null;
  tenantName: string | null;
  nextServiceDue: string | null;
  userId: string | null;
  engineer: {
    name: string | null;
    company: string | null;
    gasSafeNumber: string | null;
    phone: string | null;
    email: string | null;
  };
  jobs: Array<{
    id: string;
    title: string | null;
    status: string | null;
    jobType: string | null;
    scheduledFor: string | null;
    createdAt: string | null;
  }>;
  certificates: Array<{
    id: string;
    jobId: string | null;
    certType: string;
    label: string;
    issuedAt: string | null;
    downloadUrl: string | null;
  }>;
  hasRenewalRequest: boolean;
  renewalRequestStatus: string | null;
};

export async function getPublicPropertyByToken(token: string): Promise<PropertyVaultData | null> {
  const parsedToken = PublicTokenSchema.safeParse(token);
  if (!parsedToken.success) return null;

  const admin = await supabaseServerServiceRole();

  const { data: property, error: propErr } = await admin
    .from('properties')
    .select('id, user_id, client_id, name, address_line1, address_line2, town, postcode, phone, next_service_due, public_token')
    .eq('public_token', parsedToken.data)
    .maybeSingle();
  if (propErr) throw new Error(propErr.message);
  if (!property?.id) return null;

  const [profileResult, jobsResult, clientResult] = await Promise.all([
    property.user_id
      ? admin
          .from('profiles')
          .select('default_engineer_name, full_name, company_name, gas_safe_number, company_phone, company_email')
          .eq('id', property.user_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    admin
      .from('jobs')
      .select('id, title, status, job_type, scheduled_for, created_at, client_name, address')
      .eq('property_id', property.id)
      .order('created_at', { ascending: false }),
    property.client_id
      ? admin.from('clients').select('name, email, phone').eq('id', property.client_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const profile = profileResult.data;
  const jobs = jobsResult.data ?? [];
  const client = clientResult.data;
  const jobIds = jobs.map((j) => j.id).filter((id): id is string => typeof id === 'string');

  const { data: certificateRows } = jobIds.length
    ? await admin
        .from('certificates')
        .select('id, job_id, cert_type, issued_at, created_at, pdf_path, pdf_url')
        .in('job_id', jobIds)
        .order('issued_at', { ascending: false })
    : { data: [] };

  const certificates = await Promise.all(
    (certificateRows ?? []).map(async (cert) => {
      let downloadUrl = cert.pdf_url ?? null;
      if (cert.pdf_path) {
        const { data } = await admin.storage.from('certificates').createSignedUrl(cert.pdf_path, 3600);
        downloadUrl = data?.signedUrl ?? downloadUrl;
      }
      const certType = cert.cert_type ?? 'certificate';
      return {
        id: cert.id,
        jobId: cert.job_id ?? null,
        certType,
        label: CERTIFICATE_LABELS[certType as CertificateType] ?? certType.replaceAll('_', ' '),
        issuedAt: cert.issued_at ?? cert.created_at ?? null,
        downloadUrl,
      };
    }),
  );

  const { data: fieldRows } = jobIds.length
    ? await admin
        .from('job_fields')
        .select('job_id, field_key, value')
        .in('job_id', jobIds)
        .in('field_key', ['landlord_name', 'tenant_name', 'tenant_full_name'])
    : { data: [] };

  const latestFieldMap = new Map<string, string | null>();
  for (const job of jobs) {
    const fieldsForJob = (fieldRows ?? []).filter((field) => field.job_id === job.id);
    if (fieldsForJob.length > 0) {
      for (const field of fieldsForJob) latestFieldMap.set(field.field_key ?? '', field.value ?? null);
      break;
    }
  }

  const { data: requestRow } = await admin
    .from('job_requests')
    .select('id, status')
    .eq('property_id', property.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const address = [property.address_line1, property.address_line2, property.town, property.postcode]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .join(', ');
  const certificateNextServiceDue = deriveNextDueFromCertificates(certificates);
  const propertyNextServiceDue = normalizePublicDateOnly(property.next_service_due);
  if (
    propertyNextServiceDue &&
    certificateNextServiceDue &&
    propertyNextServiceDue !== certificateNextServiceDue
  ) {
    Sentry.captureMessage('[public-property] compliance source disagreement', {
      level: 'warning',
      extra: {
        propertyId: property.id,
        propertyNextServiceDue,
        certificateNextServiceDue,
      },
    });
  }

  return {
    token: parsedToken.data,
    propertyId: property.id,
    address,
    name: property.name ?? null,
    landlordName: pickText(latestFieldMap.get('landlord_name'), client?.name ?? null, jobs[0]?.client_name, property.name) || null,
    tenantName: pickText(latestFieldMap.get('tenant_name'), latestFieldMap.get('tenant_full_name')) || null,
    nextServiceDue: propertyNextServiceDue ?? certificateNextServiceDue,
    userId: property.user_id ?? null,
    engineer: {
      name: pickText(profile?.default_engineer_name, profile?.full_name) || null,
      company: profile?.company_name ?? null,
      gasSafeNumber: profile?.gas_safe_number ?? null,
      phone: profile?.company_phone ?? null,
      email: profile?.company_email ?? null,
    },
    jobs: jobs.map((j) => ({
      id: j.id,
      title: j.title ?? j.client_name ?? null,
      status: j.status ?? null,
      jobType: j.job_type ?? null,
      scheduledFor: j.scheduled_for ?? null,
      createdAt: j.created_at ?? null,
    })),
    certificates,
    hasRenewalRequest: !!requestRow,
    renewalRequestStatus: requestRow?.status ?? null,
  };
}

export async function submitPropertyRenewalRequest(input: z.infer<typeof RenewalRequestSchema>) {
  const request = RenewalRequestSchema.parse(input);
  const data = await getPublicPropertyByToken(request.token);
  if (!data) throw new Error('Property not found');

  const admin = await supabaseServerServiceRole();
  const acceptedDate = normalizeDateOnly(request.preferredDate);
  const preferredSummary =
    [acceptedDate, request.preferredDates].map((value) => value?.trim()).filter(Boolean).join(' · ') || null;

  // Find the most relevant existing job for this property to anchor the renewal on — prefer the most
  // recent delivered visit (its CP12 follow-up is what we schedule), falling back to the latest job.
  // This reuses the exact same confirm-date logic as the /j/ page so the two entry points behave
  // identically rather than drifting apart.
  const { data: propertyJobs } = await admin
    .from('jobs')
    .select('id, user_id, client_id, client_name, address, delivered_at, created_at')
    .eq('property_id', data.propertyId)
    .order('created_at', { ascending: false });
  const sourceJob =
    (propertyJobs ?? []).find((job) => Boolean(job.delivered_at)) ?? (propertyJobs ?? [])[0] ?? null;
  // The property row carries no landlord name; the anchoring job's client_name is the landlord.
  const landlordLabel = sourceJob?.client_name?.trim() || data.name || null;

  const renewalJobId = sourceJob
    ? await ensureRenewalJobForSource(admin, {
        sourceJob: {
          id: sourceJob.id,
          user_id: sourceJob.user_id ?? data.userId,
          client_id: sourceJob.client_id ?? null,
          client_name: sourceJob.client_name ?? data.name ?? null,
          address: sourceJob.address ?? data.address ?? null,
        },
        acceptedDate,
        tenantName: request.tenantName,
        tenantPhone: request.tenantPhone,
        accessNotes: request.accessNotes,
        propertyId: data.propertyId,
      })
    : null;

  // A confirmed date means the visit is booked, not just requested — surface it as 'scheduled' and
  // link the job so it shows in upcoming work; otherwise it stays a 'pending' request in the inbox.
  const requestStatus = acceptedDate ? 'scheduled' : 'pending';
  const insertRow: Record<string, unknown> = {
    property_id: data.propertyId,
    scheduled_job_id: renewalJobId,
    source_job_id: sourceJob?.id ?? null,
    user_id: data.userId,
    assigned_engineer_id: data.userId,
    request_type: 'renewal',
    source: 'property_vault',
    job_type: 'safety_check',
    landlord_name: landlordLabel,
    property_address: data.address,
    tenant_name: request.tenantName || null,
    tenant_phone: request.tenantPhone || null,
    access_notes: request.accessNotes || null,
    preferred_dates: preferredSummary,
    status: requestStatus,
  };
  const { error } = await admin.from('job_requests').insert(insertRow as never);
  if (error) {
    // Older databases may not have scheduled_job_id/source_job_id — retry without them rather than
    // fail the landlord's submission.
    if (['42703', 'PGRST204'].includes(error.code ?? '')) {
      delete insertRow.scheduled_job_id;
      delete insertRow.source_job_id;
      const { error: retryErr } = await admin.from('job_requests').insert(insertRow as never);
      if (retryErr) throw new Error(retryErr.message);
    } else {
      throw new Error(error.message);
    }
  }

  // A confirmed date books the renewal: record it on the property so the reminder cron stops
  // nudging and the engineer-facing UX flips to "Booked". Best-effort — never block the landlord.
  if (acceptedDate) {
    try {
      await admin
        .from('properties')
        .update({ renewal_booked_at: new Date().toISOString(), renewal_booked_date: acceptedDate } as never)
        .eq('id', data.propertyId);
    } catch (bookedErr) {
      console.error('[public-property] failed to set renewal_booked state:', bookedErr);
    }
  }

  // Confirm back to the engineer by email so the booking doesn't only live on a dashboard list.
  await notifyEngineerOfRenewalResponse({
    admin,
    engineerUserId: data.userId,
    address: data.address,
    landlordName: landlordLabel,
    acceptedDate,
    preferredDates: request.preferredDates,
    tenantName: request.tenantName,
    tenantPhone: request.tenantPhone,
    accessNotes: request.accessNotes,
    renewalJobId,
  });

  return { ok: true, engineer: data.engineer, scheduled: Boolean(acceptedDate) };
}
