import { RequestLandlordDetailsCard } from '@/components/jobs/request-landlord-details-card';
import { SoloJobForm, type SavedPropertyOption } from '@/components/jobs/solo-job-form';
import { ProfileRequiredCard } from '@/components/profile/profile-required-card';
import { getMissingOnboardingFields, isOnboardingProfileComplete } from '@/lib/onboarding-profile';
import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { listClients } from '@/server/clients';
import { getJobRequestPrefill, getOrCreateEngineerRequestLink, type JobRequestPrefill } from '@/server/job-requests';
import { getProfile } from '@/server/profile';

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

export default async function NewJobPage({
  searchParams,
}: {
  searchParams?: Promise<{ requestId?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const requestIdParam = Array.isArray(resolvedSearchParams?.requestId)
    ? resolvedSearchParams?.requestId[0]
    : resolvedSearchParams?.requestId;
  const { profile } = await getProfile();
  if (!isOnboardingProfileComplete(profile)) {
    return <ProfileRequiredCard title="Finish your profile before creating a job" missingFields={getMissingOnboardingFields(profile)} />;
  }

  const clients = await listClients();
  const supabase = await supabaseServerReadOnly();
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
  const { data: clientJobs, error: jobsErr } = clientIds.length
    ? await supabase.from('jobs').select('id, client_id, address, created_at').in('client_id', clientIds).order('created_at', { ascending: false })
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

  (clientJobs ?? []).forEach((job) => {
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
      label: '',
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

      {!requestIdParam && requestLink ? <RequestLandlordDetailsCard requestUrl={requestLink.url} /> : null}

      <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-5">
        <SoloJobForm
          key={requestPrefill?.id ?? 'manual-job'}
          clients={clients}
          propertiesByClientId={propertiesByClientId}
          initialRequest={requestPrefill}
        />
      </div>
    </div>
  );
}
