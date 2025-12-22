'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { supabaseServerReadOnly, supabaseServerServiceRole } from '@/lib/supabaseServer';
import type { Database } from '@/lib/database.types';
import type { ClientListItem } from '@/types/client';

type ClientRow = Database['public']['Tables']['clients']['Row'];
type ReportRow = Database['public']['Tables']['reports']['Row'];

function normalizeClientRow(row: ClientRow): ClientListItem {
  return {
    id: row.id,
    name: row.name,
    organization: row.organization ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    address: row.address ?? null,
    user_id: row.user_id ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

const ClientId = z.string().uuid();
const ClientSchema = z.object({
  name: z.string().min(2, 'Client name required'),
  organization: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export async function listClients(search?: string): Promise<ClientListItem[]> {
  const sb = await supabaseServerReadOnly();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  let clientsQuery = sb
    .from('clients')
    .select('id, name, organization, email, phone, address, created_at, updated_at, user_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (search) {
    const term = `%${search}%`;
    clientsQuery = clientsQuery.or(`name.ilike.${term},organization.ilike.${term},email.ilike.${term}`);
  }

  const { data: clients, error: clientsErr } = await clientsQuery;
  if (clientsErr) {
    throw new Error(clientsErr.message);
  }

  return (clients ?? []).map(normalizeClientRow);
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
        })
      : ClientSchema.parse(payload);

  const sb = await supabaseServerServiceRole();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  const { data: clientData, error: insertClientErr } = await sb
    .from('clients')
    .insert({
      name: body.name,
      organization: body.organization ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      address: body.address ?? null,
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

  const { data: clientRow, error: clientErr } = await sb
    .from('clients')
    .select('id, name, organization, email, phone, address, user_id, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();

  if (clientErr) {
    throw new Error(clientErr.message);
  }

  if (!clientRow) {
    throw new Error('Client not found');
  }

  if (clientRow.user_id && clientRow.user_id !== user.id) throw new Error('Unauthorized');

  const normalized = normalizeClientRow(clientRow);

  const { data: jobs, error: jobsErr } = await sb
    .from('jobs')
    .select('id, title, status, scheduled_for, created_at, template_id, notes, address')
    .eq('client_id', id)
    .order('created_at', { ascending: false });

  if (jobsErr) throw new Error(jobsErr.message);

  const jobIds = (jobs ?? []).map((job) => job.id);

  let reports: ReportRow[] = [];
  if (jobIds.length) {
    const { data: reportRows, error: reportErr } = await sb
      .from('reports')
      .select('id, job_id, storage_path, generated_at, created_at, updated_at')
      .in('job_id', jobIds);
    if (reportErr) throw new Error(reportErr.message);
    reports = reportRows ?? [];
  }

  return {
    client: normalized,
    jobs: jobs ?? [],
    reports,
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

  const { error: updateClientErr, count: clientCount } = await sb
    .from('clients')
    .update({
      name: body.name,
      organization: body.organization ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      address: body.address ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsedId)
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

  const { error: delClientErr } = await sb.from('clients').delete().eq('id', id).eq('user_id', user.id);

  if (delClientErr) {
    throw new Error(delClientErr.message);
  }

  revalidatePath('/clients');
}