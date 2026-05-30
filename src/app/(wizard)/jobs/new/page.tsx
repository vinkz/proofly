import { SoloJobForm, type SavedPropertyOption } from '@/components/jobs/solo-job-form';
import { ProfileRequiredCard } from '@/components/profile/profile-required-card';
import { getMissingOnboardingFields, isOnboardingProfileComplete } from '@/lib/onboarding-profile';
import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { listClients } from '@/server/clients';
import { getJobRequestPrefill, getOrCreateEngineerRequestLink, type JobRequestPrefill } from '@/server/job-requests';
import { getProfile } from '@/server/profile';
import { JOB_TYPES, type JobType } from '@/types/job-records';

const pickText = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return '';
};

const splitAddressParts = (value: string | null | undefined) =>
  String(value ?? '')
    .split(/[\r\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean);

const normalizeDateOnly = (value: string | null | undefined) => {
  const dateOnly = String(value ?? '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dateOnly) ? dateOnly : '';
};

const formatDueDate = (value: string | null | undefined) => {
  const dateOnly = normalizeDateOnly(value);
  if (!dateOnly) return null;
  return new Date(`${dateOnly}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const getComplianceBadge = (value: string | null | undefined) => {
  const dateOnly = normalizeDateOnly(value);
  if (!dateOnly) return 'No due date';
  const due = new Date(`${dateOnly}T00:00:00`).getTime();
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  if (due < todayStart) return 'Red';
  if (due <= todayStart + 60 * 24 * 60 * 60 * 1000) return 'Amber';
  return 'Green';
};

export default async function NewJobPage({
  searchParams,
}: {
  searchParams?: Promise<{
    requestId?: string | string[];
    clientId?: string | string[];
    propertyId?: string | string[];
    jobType?: string | string[];
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const requestIdParam = Array.isArray(resolvedSearchParams?.requestId)
    ? resolvedSearchParams?.requestId[0]
    : resolvedSearchParams?.requestId;
  const requestedClientId = Array.isArray(resolvedSearchParams?.clientId)
    ? resolvedSearchParams?.clientId[0]
    : resolvedSearchParams?.clientId;
  const requestedPropertyId = Array.isArray(resolvedSearchParams?.propertyId)
    ? resolvedSearchParams?.propertyId[0]
    : resolvedSearchParams?.propertyId;
  const requestedJobType = Array.isArray(resolvedSearchParams?.jobType)
    ? resolvedSearchParams?.jobType[0]
    : resolvedSearchParams?.jobType;
  const initialJobType = JOB_TYPES.includes(requestedJobType as JobType) ? (requestedJobType as JobType) : null;
  const { profile } = await getProfile();
  if (!isOnboardingProfileComplete(profile)) {
    return <ProfileRequiredCard title="Finish your profile before creating a job" missingFields={getMissingOnboardingFields(profile)} />;
  }

  const clients = await listClients();
  const supabase = await supabaseServerReadOnly();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) throw new Error(userErr?.message ?? 'Unauthorized');
  let requestPrefill: JobRequestPrefill | null = null;
  let requestPrefillError = '';
  if (requestIdParam) {
    try {
      requestPrefill = await getJobRequestPrefill(requestIdParam);
    } catch (error) {
      requestPrefillError = error instanceof Error ? error.message : 'Unable to load landlord request.';
    }
  }
  const requestLink = requestIdParam ? null : await getOrCreateEngineerRequestLink();

  const clientIdToPrimary = new Map<string, string>();
  clients.forEach((client) => {
    const ids = client.client_ids ?? [client.id];
    ids.forEach((id) => clientIdToPrimary.set(id, client.id));
  });

  const clientIds = Array.from(clientIdToPrimary.keys());
  const { data: propertyRows, error: propertiesErr } = clientIds.length
    ? await supabase
        .from('properties')
        .select('id, client_id, name, address_line1, address_line2, town, postcode, phone, next_service_due, updated_at')
        .eq('user_id', user.id)
        .in('client_id', clientIds)
        .order('updated_at', { ascending: false })
    : { data: [], error: null };
  if (propertiesErr) throw new Error(propertiesErr.message);

  const propertyStartRow = requestedPropertyId
    ? (propertyRows ?? []).find((property) => property.id === requestedPropertyId)
    : null;
  const initialClientId =
    requestedClientId && clientIdToPrimary.has(requestedClientId)
      ? clientIdToPrimary.get(requestedClientId) ?? requestedClientId
      : propertyStartRow?.client_id
        ? clientIdToPrimary.get(propertyStartRow.client_id) ?? propertyStartRow.client_id
        : null;
  const initialPropertyId =
    propertyStartRow && initialClientId
      ? propertyStartRow.id
      : requestedPropertyId && (propertyRows ?? []).some((property) => property.id === requestedPropertyId)
        ? requestedPropertyId
        : null;

  const propertyIds = (propertyRows ?? [])
    .map((property) => property.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  const { data: propertyJobs, error: propertyJobsErr } = propertyIds.length
    ? await supabase
        .from('jobs')
        .select('id, property_id, created_at, delivered_at, completed_at, scheduled_for')
        .eq('user_id', user.id)
        .in('property_id', propertyIds)
        .order('created_at', { ascending: false })
    : { data: [], error: null };
  if (propertyJobsErr) throw new Error(propertyJobsErr.message);

  const { data: clientJobs, error: jobsErr } = clientIds.length
    ? await supabase.from('jobs').select('id, client_id, property_id, address, created_at').in('client_id', clientIds).order('created_at', { ascending: false })
    : { data: [], error: null };
  if (jobsErr) throw new Error(jobsErr.message);

  const propertyJobIds = (clientJobs ?? [])
    .map((job) => job.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  const fieldKeys = [
    'job_address_name',
    'job_address_line1',
    'job_address_line2',
    'job_address_city',
    'job_postcode',
    'job_tel',
    'landlord_name',
    'landlord_company',
    'landlord_address_line1',
    'landlord_address_line2',
    'landlord_address',
    'landlord_city',
    'landlord_postcode',
    'landlord_tel',
    'landlord_email',
    'customer_email',
    'customer_phone',
  ];
  const { data: propertyFieldRows, error: propertyFieldsErr } = propertyJobIds.length
    ? await supabase.from('job_fields').select('job_id, field_key, value').in('job_id', propertyJobIds).in('field_key', fieldKeys)
    : { data: [], error: null };
  if (propertyFieldsErr) throw new Error(propertyFieldsErr.message);

  const fieldsByJob = (propertyFieldRows ?? []).reduce<Record<string, Record<string, string>>>((acc, row) => {
    const jobId = row.job_id ?? '';
    const fieldKey = row.field_key ?? '';
    const value = row.value?.trim() ?? '';
    if (!jobId || !fieldKey || !value) return acc;
    acc[jobId] = acc[jobId] ?? {};
    acc[jobId][fieldKey] = value;
    return acc;
  }, {});

  const propertiesByClientId = clients.reduce<Record<string, SavedPropertyOption[]>>((acc, client) => {
    acc[client.id] = [];
    return acc;
  }, {});
  const clientByPrimaryId = new Map(clients.map((client) => [client.id, client]));
  const seenByClient = new Map<string, Set<string>>();
  const latestJobByPropertyId = new Map<string, string>();
  (propertyJobs ?? []).forEach((job) => {
    const propertyId = job.property_id ?? '';
    if (!propertyId || latestJobByPropertyId.has(propertyId)) return;
    latestJobByPropertyId.set(propertyId, job.id);
  });

  (propertyRows ?? []).forEach((property) => {
    const rawClientId = property.client_id ?? '';
    const clientId = rawClientId ? clientIdToPrimary.get(rawClientId) ?? rawClientId : '';
    if (!clientId || !propertiesByClientId[clientId]) return;
    const client = clientByPrimaryId.get(clientId);
    if (!client || !property.address_line1) return;

    const landlordAddressParts = splitAddressParts(pickText(client.landlord_address, client.address));
    const dueDate = formatDueDate(property.next_service_due);
    const complianceBadge = getComplianceBadge(property.next_service_due);
    const label = [
      property.name || property.address_line1,
      [property.address_line1, property.town, property.postcode].filter(Boolean).join(', '),
    ]
      .filter(Boolean)
      .join(' - ');
    const option: SavedPropertyOption = {
      key: property.id,
      property_id: property.id,
      source_job_id: latestJobByPropertyId.get(property.id) ?? '',
      label,
      next_service_due: dueDate,
      compliance_badge: complianceBadge,
      job_address_name: property.name ?? '',
      job_address_line1: property.address_line1 ?? '',
      job_address_line2: property.address_line2 ?? '',
      job_address_city: property.town ?? '',
      job_postcode: property.postcode ?? '',
      job_tel: property.phone ?? '',
      landlord_name: pickText(client.landlord_name, client.name),
      landlord_company: client.organization ?? '',
      landlord_address_line1: landlordAddressParts[0] ?? '',
      landlord_address_line2: landlordAddressParts.length > 2 ? landlordAddressParts.slice(1, -1).join(', ') : '',
      landlord_city: landlordAddressParts.length > 1 ? landlordAddressParts.at(-1) ?? '' : '',
      landlord_postcode: client.postcode ?? '',
      landlord_tel: client.phone ?? '',
      landlord_email: client.email ?? '',
    };
    const dedupeKey = [option.job_address_line1, option.job_address_city, option.job_postcode].join('::').toLowerCase();
    const seen = seenByClient.get(clientId) ?? new Set<string>();
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    seenByClient.set(clientId, seen);
    propertiesByClientId[clientId].push(option);
  });

  (clientJobs ?? []).forEach((job) => {
    if (job.property_id) return;
    const rawClientId = job.client_id ?? '';
    const clientId = rawClientId ? clientIdToPrimary.get(rawClientId) ?? rawClientId : '';
    if (!clientId || !propertiesByClientId[clientId]) return;
    const client = clientByPrimaryId.get(clientId);
    if (!client) return;

    const fields = fieldsByJob[job.id] ?? {};
    const landlordAddressParts = splitAddressParts(pickText(fields.landlord_address, client.landlord_address, client.address));
    const parts = splitAddressParts(job.address);
    const property: SavedPropertyOption = {
      key: job.id,
      source_job_id: job.id,
      label: '',
      next_service_due: null,
      compliance_badge: 'Legacy',
      job_address_name: pickText(fields.job_address_name),
      job_address_line1: pickText(fields.job_address_line1, parts[0]),
      job_address_line2: pickText(fields.job_address_line2),
      job_address_city: pickText(fields.job_address_city, parts.length > 1 ? parts.at(-1) ?? '' : ''),
      job_postcode: pickText(fields.job_postcode),
      job_tel: pickText(fields.job_tel),
      landlord_name: pickText(fields.landlord_name, client.landlord_name, client.name),
      landlord_company: pickText(fields.landlord_company, client.organization),
      landlord_address_line1: pickText(fields.landlord_address_line1, landlordAddressParts[0]),
      landlord_address_line2: pickText(
        fields.landlord_address_line2,
        landlordAddressParts.length > 2 ? landlordAddressParts.slice(1, -1).join(', ') : '',
      ),
      landlord_city: pickText(fields.landlord_city, landlordAddressParts.length > 1 ? landlordAddressParts.at(-1) ?? '' : ''),
      landlord_postcode: pickText(fields.landlord_postcode, client.postcode),
      landlord_tel: pickText(fields.landlord_tel, fields.customer_phone, client.phone),
      landlord_email: pickText(fields.landlord_email, fields.customer_email, client.email),
    };

    if (!property.job_address_line1) return;

    property.label = [property.job_address_name || property.job_address_line1, [property.job_address_line1, property.job_address_city, property.job_postcode].filter(Boolean).join(', ')]
      .filter(Boolean)
      .join(' - ');

    const dedupeKey = [
      property.job_address_name,
      property.job_address_line1,
      property.job_address_city,
      property.job_postcode,
      property.job_tel,
    ]
      .join('::')
      .toLowerCase();
    const seen = seenByClient.get(clientId) ?? new Set<string>();
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    seenByClient.set(clientId, seen);
    propertiesByClientId[clientId].push(property);
  });

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-6 sm:py-10">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-[var(--color-text-primary)]">
          New job
        </h1>
        <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
          Choose the job type, then fill in the details or ask the landlord to send them.
        </p>
      </div>

      {requestIdParam ? (
        requestPrefill ? (
          <div className="rounded-[12px] border-[0.5px] border-[var(--color-action)]/30 bg-[var(--color-action-bg)] px-4 py-3 text-[13px]">
            <p className="font-medium text-[var(--color-action)]">Landlord request loaded</p>
            <p className="mt-0.5 text-[var(--color-text-secondary)]">
              Prefilling from {requestPrefill.landlordName || 'landlord'} for {requestPrefill.propertyAddress || 'the requested property'}.
            </p>
          </div>
        ) : (
          <div className="rounded-[12px] border-[0.5px] border-[var(--color-amber)]/30 bg-[var(--color-amber-bg)] px-4 py-3 text-[13px]">
            <p className="font-medium text-[var(--color-text-primary)]">Landlord request not loaded</p>
            <p className="mt-0.5 text-[var(--color-text-secondary)]">
              {requestPrefillError || `The request link was received, but no request row loaded for ID ${requestIdParam}.`}
            </p>
          </div>
        )
      ) : null}

      <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-5">
        <SoloJobForm
          key={requestPrefill?.id ?? 'manual-job'}
          clients={clients}
          propertiesByClientId={propertiesByClientId}
          initialRequest={requestPrefill}
          requestUrl={requestLink?.url ?? null}
          initialSelection={
            initialClientId || initialPropertyId || initialJobType
              ? {
                  clientId: initialClientId,
                  propertyId: initialPropertyId,
                  jobType: initialJobType,
                }
              : null
          }
        />
      </div>
    </div>
  );
}
