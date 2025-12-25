'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { supabaseServerReadOnly, supabaseServerServiceRole } from '@/lib/supabaseServer';
import type { Database } from '@/lib/database.types';
import type { ClientListItem } from '@/types/client';

type ClientRow = Database['public']['Tables']['clients']['Row'];
type ReportRow = Database['public']['Tables']['reports']['Row'];
type JobFieldRow = Database['public']['Tables']['job_fields']['Row'];
type JobSummaryRow = Pick<
  Database['public']['Tables']['jobs']['Row'],
  'id' | 'title' | 'status' | 'scheduled_for' | 'created_at' | 'template_id' | 'notes' | 'address'
>;

const normalizeIdentityValue = (value: string | null | undefined) => value?.trim().toLowerCase() ?? '';

const getClientIdentityKey = (row: Pick<ClientRow, 'name' | 'email'>) =>
  `${normalizeIdentityValue(row.name)}::${normalizeIdentityValue(row.email)}`;

const parseDateValue = (value: string | null | undefined) => {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const pickMostRecentRow = (rows: ClientRow[]) =>
  rows.reduce((current, row) =>
    parseDateValue(row.updated_at ?? row.created_at) > parseDateValue(current.updated_at ?? current.created_at)
      ? row
      : current,
  );

const pickFirstNonEmpty = (values: Array<string | null | undefined>) =>
  values.find((value) => typeof value === 'string' && value.trim().length > 0) ?? null;

const mergeClientGroup = (rows: ClientRow[]): ClientListItem => {
  const rowsSorted = [...rows].sort(
    (a, b) =>
      parseDateValue(b.updated_at ?? b.created_at) - parseDateValue(a.updated_at ?? a.created_at),
  );
  const primary = pickMostRecentRow(rowsSorted);
  const createdAt =
    rows.reduce((min, row) => Math.min(min, parseDateValue(row.created_at)), Number.POSITIVE_INFINITY) || 0;
  const updatedAt =
    rows.reduce((max, row) => Math.max(max, parseDateValue(row.updated_at ?? row.created_at)), 0) || 0;

  return {
    id: primary.id,
    name: primary.name,
    organization: pickFirstNonEmpty(rowsSorted.map((row) => row.organization)),
    email: pickFirstNonEmpty(rowsSorted.map((row) => row.email)),
    phone: pickFirstNonEmpty(rowsSorted.map((row) => row.phone)),
    address: pickFirstNonEmpty(rowsSorted.map((row) => row.address)),
    postcode: pickFirstNonEmpty(rowsSorted.map((row) => row.postcode)),
    landlord_name: pickFirstNonEmpty(rowsSorted.map((row) => row.landlord_name)),
    landlord_address: pickFirstNonEmpty(rowsSorted.map((row) => row.landlord_address)),
    user_id: primary.user_id ?? null,
    created_at: createdAt ? new Date(createdAt).toISOString() : primary.created_at ?? null,
    updated_at: updatedAt ? new Date(updatedAt).toISOString() : primary.updated_at ?? null,
    client_ids: rows.map((row) => row.id),
  };
};

const groupClients = (rows: ClientRow[]) => {
  const grouped = new Map<string, ClientRow[]>();
  rows.forEach((row) => {
    const key = getClientIdentityKey(row);
    const existing = grouped.get(key);
    if (existing) {
      existing.push(row);
    } else {
      grouped.set(key, [row]);
    }
  });

  return Array.from(grouped.values()).map(mergeClientGroup).sort((a, b) => {
    const aUpdated = parseDateValue(a.updated_at ?? a.created_at);
    const bUpdated = parseDateValue(b.updated_at ?? b.created_at);
    return bUpdated - aUpdated;
  });
};

const matchesSearch = (client: ClientListItem, search: string) => {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return [client.name, client.organization, client.email]
    .filter((value): value is string => typeof value === 'string')
    .some((value) => value.toLowerCase().includes(term));
};

const normalizeOptional = (value: string | null | undefined) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizeValue = (value: string | null | undefined) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const pickJobFieldValue = (rows: JobFieldRow[], keys: string[]) => {
  for (const row of rows) {
    if (keys.includes(row.field_key)) {
      const value = normalizeValue(row.value);
      if (value) return value;
    }
  }
  return null;
};

const ClientId = z.string().uuid();
const ClientSchema = z.object({
  name: z.string().min(2, 'Client name required'),
  organization: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  postcode: z.string().optional(),
  landlord_name: z.string().optional(),
  landlord_address: z.string().optional(),
});

export async function listClients(search?: string): Promise<ClientListItem[]> {
  const sb = await supabaseServerReadOnly();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  const clientsQuery = sb
    .from('clients')
    .select(
      'id, name, organization, email, phone, address, postcode, landlord_name, landlord_address, created_at, updated_at, user_id',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  const { data: clients, error: clientsErr } = await clientsQuery;
  if (clientsErr) {
    throw new Error(clientsErr.message);
  }

  const grouped = groupClients((clients ?? []) as ClientRow[]);
  if (!search) {
    return grouped;
  }

  return grouped.filter((client) => matchesSearch(client, search));
}

export async function createClient(payload: FormData | Record<string, unknown>) {
  const body =
    payload instanceof FormData
      ? ClientSchema.parse({
          name: payload.get('name'),
          organization: payload.get('organization') ?? undefined,
          email: payload.get('email') ?? undefined,
          phone: payload.get('phone') ?? undefined,
          address: payload.get('address') ?? undefined,
          postcode: payload.get('postcode') ?? undefined,
          landlord_name: payload.get('landlord_name') ?? undefined,
          landlord_address: payload.get('landlord_address') ?? undefined,
        })
      : ClientSchema.parse(payload);
  const normalized = {
    name: body.name.trim(),
    organization: normalizeOptional(body.organization),
    email: normalizeOptional(body.email),
    phone: normalizeOptional(body.phone),
    address: normalizeOptional(body.address),
    postcode: normalizeOptional(body.postcode),
    landlord_name: normalizeOptional(body.landlord_name),
    landlord_address: normalizeOptional(body.landlord_address),
  };

  const sb = await supabaseServerServiceRole();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  const { data: existingClients, error: existingErr } = await sb
    .from('clients')
    .select('id, name, organization, email, phone, address, postcode, landlord_name, landlord_address')
    .eq('user_id', user.id);

  if (existingErr) {
    throw new Error(existingErr.message);
  }

  const match = (existingClients ?? []).find(
    (client) => getClientIdentityKey(client) === getClientIdentityKey(normalized),
  );

  if (match) {
    const updatePayload: Partial<ClientRow> = {};
    if (normalized.organization && !match.organization) updatePayload.organization = normalized.organization;
    if (normalized.phone && !match.phone) updatePayload.phone = normalized.phone;
    if (normalized.address && !match.address) updatePayload.address = normalized.address;
    if (normalized.postcode && !match.postcode) updatePayload.postcode = normalized.postcode;
    if (normalized.landlord_name && !match.landlord_name) updatePayload.landlord_name = normalized.landlord_name;
    if (normalized.landlord_address && !match.landlord_address) updatePayload.landlord_address = normalized.landlord_address;

    if (Object.keys(updatePayload).length) {
      updatePayload.updated_at = new Date().toISOString();
      const { error: updateErr } = await sb
        .from('clients')
        .update(updatePayload)
        .eq('id', match.id)
        .eq('user_id', user.id);
      if (updateErr) {
        throw new Error(updateErr.message);
      }
    }

    revalidatePath('/clients');
    return { id: match.id };
  }

  const { data: clientData, error: insertClientErr } = await sb
    .from('clients')
    .insert({
      name: normalized.name,
      organization: normalized.organization,
      email: normalized.email,
      phone: normalized.phone,
      address: normalized.address,
      postcode: normalized.postcode,
      landlord_name: normalized.landlord_name,
      landlord_address: normalized.landlord_address,
      user_id: user.id,
    })
    .select('id')
    .single();

  if (insertClientErr) {
    throw new Error(insertClientErr.message ?? 'Unable to create client');
  }

  revalidatePath('/clients');
  return { id: clientData.id };
}

export async function getClientDetail(id: string) {
  ClientId.parse(id);
  const sb = await supabaseServerReadOnly();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  const { data: clientRows, error: clientErr } = await sb
    .from('clients')
    .select('id, name, organization, email, phone, address, postcode, landlord_name, landlord_address, user_id, created_at, updated_at')
    .eq('user_id', user.id);

  if (clientErr) {
    throw new Error(clientErr.message);
  }

  const selected = (clientRows ?? []).find((client) => client.id === id);
  if (!selected) {
    throw new Error('Client not found');
  }

  const selectedKey = getClientIdentityKey(selected);
  const groupRows = (clientRows ?? []).filter((row) => getClientIdentityKey(row) === selectedKey);
  const normalized = mergeClientGroup(groupRows);
  const clientIds = groupRows.map((row) => row.id);

  const { data: jobs, error: jobsErr } = await sb
    .from('jobs')
    .select('id, title, status, scheduled_for, created_at, template_id, notes, address')
    .in('client_id', clientIds)
    .order('created_at', { ascending: false });

  if (jobsErr) throw new Error(jobsErr.message);

  const jobMap = new Map<string, JobSummaryRow>();
  (jobs ?? []).forEach((job) => {
    if (job?.id) {
      jobMap.set(job.id, job as JobSummaryRow);
    }
  });

  const nameMatch = normalizeValue(normalized.name);
  const emailMatch = normalizeValue(normalized.email);

  if (nameMatch && emailMatch) {
    const [nameFields, emailFields] = await Promise.all([
      sb
        .from('job_fields')
        .select('job_id')
        .eq('field_key', 'customer_name')
        .ilike('value', nameMatch),
      sb
        .from('job_fields')
        .select('job_id')
        .eq('field_key', 'customer_email')
        .ilike('value', emailMatch),
    ]);

    if (nameFields.error) throw new Error(nameFields.error.message);
    if (emailFields.error) throw new Error(emailFields.error.message);

    const emailJobIds = new Set(
      (emailFields.data ?? [])
        .map((row) => row.job_id)
        .filter((jobId): jobId is string => typeof jobId === 'string'),
    );
    const matchedJobIds = (nameFields.data ?? [])
      .map((row) => row.job_id)
      .filter((jobId): jobId is string => typeof jobId === 'string' && emailJobIds.has(jobId));

    const missingJobIds = matchedJobIds.filter((jobId) => !jobMap.has(jobId));
    if (missingJobIds.length) {
      const { data: extraJobs, error: extraErr } = await sb
        .from('jobs')
        .select('id, title, status, scheduled_for, created_at, template_id, notes, address')
        .in('id', missingJobIds)
        .eq('user_id', user.id);
      if (extraErr) throw new Error(extraErr.message);
      (extraJobs ?? []).forEach((job) => {
        if (job?.id) {
          jobMap.set(job.id, job as JobSummaryRow);
        }
      });
    }
  }

  const mergedJobs = Array.from(jobMap.values()).sort((a, b) => {
    const aDate = parseDateValue(a?.created_at ?? null);
    const bDate = parseDateValue(b?.created_at ?? null);
    return bDate - aDate;
  });

  const jobIds = mergedJobs.map((job) => job.id);

  let jobFieldRows: JobFieldRow[] = [];
  if (jobIds.length) {
    const { data: fieldRows, error: fieldErr } = await sb
      .from('job_fields')
      .select('job_id, field_key, value, created_at')
      .in('job_id', jobIds)
      .in('field_key', [
        'customer_email',
        'email',
        'customer_phone',
        'phone',
        'customer_address',
        'client_address',
        'billing_address',
        'property_address',
        'property_postcode',
        'postcode',
        'landlord_name',
        'landlord_address',
        'customer_company',
        'organization',
      ])
      .order('created_at', { ascending: false });

    if (fieldErr) throw new Error(fieldErr.message);
    jobFieldRows = (fieldRows ?? []) as JobFieldRow[];
  }

  const jobEmail = pickJobFieldValue(jobFieldRows, ['customer_email', 'email']);
  const jobPhone = pickJobFieldValue(jobFieldRows, ['customer_phone', 'phone']);
  const jobAddress = pickJobFieldValue(jobFieldRows, [
    'customer_address',
    'client_address',
    'billing_address',
    'property_address',
  ]);
  const jobPostcode = pickJobFieldValue(jobFieldRows, ['property_postcode', 'postcode']);
  const jobLandlordName = pickJobFieldValue(jobFieldRows, ['landlord_name']);
  const jobLandlordAddress = pickJobFieldValue(jobFieldRows, ['landlord_address']);
  const jobOrganization = pickJobFieldValue(jobFieldRows, ['customer_company', 'organization']);

  const contactDetails = {
    name: normalized.name,
    organization: normalized.organization ?? jobOrganization,
    email: normalized.email ?? jobEmail,
    phone: normalized.phone ?? jobPhone,
    address: normalized.address ?? jobAddress,
    postcode: normalized.postcode ?? jobPostcode,
    landlord_name: normalized.landlord_name ?? jobLandlordName,
    landlord_address: normalized.landlord_address ?? jobLandlordAddress,
  };

  const contactSources = {
    organization: normalized.organization ? 'client' : jobOrganization ? 'job' : null,
    email: normalized.email ? 'client' : jobEmail ? 'job' : null,
    phone: normalized.phone ? 'client' : jobPhone ? 'job' : null,
    address: normalized.address ? 'client' : jobAddress ? 'job' : null,
    postcode: normalized.postcode ? 'client' : jobPostcode ? 'job' : null,
    landlord_name: normalized.landlord_name ? 'client' : jobLandlordName ? 'job' : null,
    landlord_address: normalized.landlord_address ? 'client' : jobLandlordAddress ? 'job' : null,
  };

  let reports: ReportRow[] = [];
  if (jobIds.length) {
    const { data: reportRows, error: reportErr } = await sb
      .from('reports')
      .select('id, job_id, storage_path, generated_at, created_at, updated_at, kind')
      .in('job_id', jobIds);
    if (reportErr) throw new Error(reportErr.message);
    reports = reportRows ?? [];
  }

  return {
    client: normalized,
    jobs: mergedJobs,
    reports,
    contactDetails,
    contactSources,
  };
}

export async function updateClient(payload: FormData | Record<string, unknown>) {
  const body =
    payload instanceof FormData
      ? ClientSchema.parse({
          name: payload.get('name'),
          organization: payload.get('organization') ?? undefined,
          email: payload.get('email') ?? undefined,
          phone: payload.get('phone') ?? undefined,
          address: payload.get('address') ?? undefined,
          postcode: payload.get('postcode') ?? undefined,
          landlord_name: payload.get('landlord_name') ?? undefined,
          landlord_address: payload.get('landlord_address') ?? undefined,
        })
      : ClientSchema.parse(payload);

  const id = payload instanceof FormData ? payload.get('id') : (payload as { id?: unknown })?.id;
  const parsedId = ClientId.parse(id);

  const readClient = await supabaseServerReadOnly();
  const {
    data: { user },
    error,
  } = await readClient.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  const sb = await supabaseServerServiceRole();

  const { data: clientRows, error: loadErr } = await sb
    .from('clients')
    .select('id, name, email, user_id')
    .eq('user_id', user.id);

  if (loadErr) {
    throw new Error(loadErr.message);
  }

  const target = (clientRows ?? []).find((client) => client.id === parsedId);
  if (!target) {
    throw new Error('Client not found');
  }

  const targetKey = getClientIdentityKey(target);
  const groupedIds = (clientRows ?? [])
    .filter((client) => getClientIdentityKey(client) === targetKey)
    .map((client) => client.id);

  const updatePayload = {
    name: body.name.trim(),
    organization: normalizeOptional(body.organization),
    email: normalizeOptional(body.email),
    phone: normalizeOptional(body.phone),
    address: normalizeOptional(body.address),
    postcode: normalizeOptional(body.postcode),
    landlord_name: normalizeOptional(body.landlord_name),
    landlord_address: normalizeOptional(body.landlord_address),
    updated_at: new Date().toISOString(),
  };

  const { error: updateClientErr, count: clientCount } = await sb
    .from('clients')
    .update(updatePayload)
    .in('id', groupedIds)
    .eq('user_id', user.id);

  if (updateClientErr) {
    throw new Error(updateClientErr.message);
  }

  if (clientCount && clientCount > 0) {
    revalidatePath('/clients');
    revalidatePath(`/clients/${parsedId}`);
    return { id: parsedId };
  }

  throw new Error('Unable to update client or client not found');
}

export async function deleteClient(id: string) {
  ClientId.parse(id);
  const readClient = await supabaseServerReadOnly();
  const {
    data: { user },
    error,
  } = await readClient.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  const sb = await supabaseServerServiceRole();

  const { data: clientRows, error: loadErr } = await sb
    .from('clients')
    .select('id, name, email, user_id')
    .eq('user_id', user.id);

  if (loadErr) {
    throw new Error(loadErr.message);
  }

  const target = (clientRows ?? []).find((client) => client.id === id);
  if (!target) {
    throw new Error('Client not found');
  }

  const targetKey = getClientIdentityKey(target);
  const groupedIds = (clientRows ?? [])
    .filter((client) => getClientIdentityKey(client) === targetKey)
    .map((client) => client.id);

  const { error: delClientErr } = await sb
    .from('clients')
    .delete()
    .in('id', groupedIds)
    .eq('user_id', user.id);

  if (delClientErr) {
    throw new Error(delClientErr.message);
  }

  revalidatePath('/clients');
}
