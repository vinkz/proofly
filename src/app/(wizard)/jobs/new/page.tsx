import { Card } from '@/components/ui/card';
import { SoloJobForm, type SavedPropertyOption } from '@/components/jobs/solo-job-form';
import { ProfileRequiredCard } from '@/components/profile/profile-required-card';
import { getMissingOnboardingFields, isOnboardingProfileComplete } from '@/lib/onboarding-profile';
import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { listClients } from '@/server/clients';
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

export default async function NewJobPage() {
  const { profile } = await getProfile();
  if (!isOnboardingProfileComplete(profile)) {
    return <ProfileRequiredCard title="Finish your profile before creating a job" missingFields={getMissingOnboardingFields(profile)} />;
  }

  const clients = await listClients();
  const supabase = await supabaseServerReadOnly();

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

  const fieldKeys = ['job_address_name', 'job_address_line1', 'job_address_city', 'job_postcode', 'job_tel'];
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
  const seenByClient = new Map<string, Set<string>>();

  (clientJobs ?? []).forEach((job) => {
    const rawClientId = job.client_id ?? '';
    const clientId = rawClientId ? clientIdToPrimary.get(rawClientId) ?? rawClientId : '';
    if (!clientId || !propertiesByClientId[clientId]) return;

    const fields = fieldsByJob[job.id] ?? {};
    const parts = splitAddressParts(job.address);
    const property: SavedPropertyOption = {
      key: job.id,
      label: '',
      job_address_name: pickText(fields.job_address_name),
      job_address_line1: pickText(fields.job_address_line1, parts[0]),
      job_address_city: pickText(fields.job_address_city, parts.length > 1 ? parts.at(-1) ?? '' : ''),
      job_postcode: pickText(fields.job_postcode),
      job_tel: pickText(fields.job_tel),
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
    <div className="mx-auto max-w-4xl space-y-6 py-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-[var(--brand)]">Create an upcoming job</h1>
        <p className="text-sm text-muted-foreground/80">
          Save the key job details first. CP12 upcoming jobs use the same Job Address and Landlord fields as Step 1.
        </p>
      </div>

      <Card className="border border-white/10 bg-white/95 p-6 shadow">
        <SoloJobForm clients={clients} propertiesByClientId={propertiesByClientId} />
      </Card>
    </div>
  );
}
