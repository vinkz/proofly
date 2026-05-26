'use server';

import { z } from 'zod';
import { supabaseServerServiceRole } from '@/lib/supabaseServer';
import { CERTIFICATE_LABELS, type CertificateType } from '@/types/certificates';

const PublicTokenSchema = z.string().min(16).max(128).regex(/^[a-zA-Z0-9_-]+$/);
const RenewalRequestSchema = z.object({
  token: PublicTokenSchema,
  tenantName: z.string().max(120).optional().default(''),
  tenantPhone: z.string().max(80).optional().default(''),
  accessNotes: z.string().max(1000).optional().default(''),
  preferredDates: z.string().max(500).optional().default(''),
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

  const [profileResult, jobsResult] = await Promise.all([
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
  ]);

  const profile = profileResult.data;
  const jobs = jobsResult.data ?? [];
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

  return {
    token: parsedToken.data,
    propertyId: property.id,
    address,
    name: property.name ?? null,
    nextServiceDue: property.next_service_due ?? null,
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
  const { error } = await admin.from('job_requests').insert({
    property_id: data.propertyId,
    user_id: data.userId,
    assigned_engineer_id: data.userId,
    request_type: 'renewal',
    source: 'property_vault',
    job_type: 'safety_check',
    property_address: data.address,
    tenant_name: request.tenantName || null,
    tenant_phone: request.tenantPhone || null,
    access_notes: request.accessNotes || null,
    preferred_dates: request.preferredDates || null,
    status: 'pending',
  });
  if (error) throw new Error(error.message);

  return { ok: true, engineer: data.engineer };
}
