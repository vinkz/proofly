'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { supabaseServerAction, supabaseServerReadOnly, supabaseServerServiceRole } from '@/lib/supabaseServer';
import type { Database } from '@/lib/database.types';
import type { PostgrestError } from '@supabase/supabase-js';
import type { ClientListItem } from '@/types/client';

type ClientRow = Database['public']['Tables']['clients']['Row'];
type JobRow = Database['public']['Tables']['jobs']['Row'];
type ReportRow = Database['public']['Tables']['reports']['Row'];

const CLIENT_TABLES = ['clients', 'contacts'] as const;

type NormalizedClient = ClientListItem;

function normalizeClientRow(table: (typeof CLIENT_TABLES)[number], row: Record<string, any>): NormalizedClient {
  if (table === 'clients') {
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
  return {
    id: row.id,
    name: row.name,
    organization: null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    address: row.address ?? null,
    user_id: row.user_id ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.created_at ?? null,
  };
}

function mapClientData(table: (typeof CLIENT_TABLES)[number], data: any[] | null) {
  return (data ?? []).map((row) => normalizeClientRow(table, row));
}

const ClientId = z.string().uuid();
const ClientSchema = z.object({
  name: z.string().min(2, 'Client name required'),
  organization: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export async function listClients(search?: string): Promise<NormalizedClient[]> {
  const sb = await supabaseServerReadOnly();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  let lastErr: PostgrestError | null = null;
  for (const table of CLIENT_TABLES) {
    let query = (sb as any)
      .from(table)
      .select(
        table === 'clients'
          ? 'id, name, organization, email, phone, address, created_at, updated_at, user_id'
          : 'id, name, email, phone, address, created_at, user_id',
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (search) {
      const term = `%${search}%`;
      query = query.or(
        table === 'clients'
          ? `name.ilike.${term},organization.ilike.${term},email.ilike.${term}`
          : `name.ilike.${term},email.ilike.${term}`,
      );
    }

    const { data, error: listErr } = await query;
    if (listErr) {
      if (listErr.code === '42P01') {
        lastErr = listErr;
        continue;
      }
      throw new Error(listErr.message);
    }
    return mapClientData(table, data);
  }

  if (lastErr) throw new Error(lastErr.message);
  return [];
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

  let lastErr: PostgrestError | null = null;
  for (const table of CLIENT_TABLES) {
    const payload =
      table === 'clients'
        ? {
            name: body.name,
            organization: body.organization ?? null,
            email: body.email ?? null,
            phone: body.phone ?? null,
            address: body.address ?? null,
            user_id: user.id,
          }
        : {
            name: body.name,
            email: body.email ?? null,
            phone: body.phone ?? null,
            address: body.address ?? null,
            user_id: user.id,
            created_at: new Date().toISOString(),
          };

    const { data, error: insertErr } = await (sb as any)
      .from(table)
      .insert(payload as Record<string, unknown>)
      .select('id')
      .single();
    if (insertErr || !data) {
      if (insertErr?.code === '42P01') {
        lastErr = insertErr;
        continue;
      }
      throw new Error(insertErr?.message ?? 'Unable to create client');
    }

    revalidatePath('/clients');
    return { id: data.id as string };
  }

  throw new Error(lastErr?.message ?? 'Unable to create client');
}

export async function getClientDetail(id: string) {
  ClientId.parse(id);
  const sb = await supabaseServerReadOnly();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  const typedId = id as ClientRow['id'];
  let normalized: NormalizedClient | null = null;
  let lastErr: PostgrestError | null = null;
  for (const table of CLIENT_TABLES) {
    const columns =
      table === 'clients'
        ? 'id, name, organization, email, phone, address, user_id, created_at, updated_at'
        : 'id, name, email, phone, address, user_id, created_at';
    const { data, error: clientErr } = await (sb as any)
      .from(table)
      .select(columns)
      .eq('id', typedId)
      .maybeSingle();
    if (clientErr) {
      if (clientErr.code === '42P01') {
        lastErr = clientErr;
        continue;
      }
      throw new Error(clientErr.message);
    }
    if (!data) continue;
    normalized = normalizeClientRow(table, data as Record<string, unknown>);
    break;
  }

  if (!normalized) {
    if (lastErr) throw new Error(lastErr.message);
    throw new Error('Client not found');
  }

  if (normalized.user_id && normalized.user_id !== user.id) throw new Error('Unauthorized');

  const { data: jobs, error: jobsErr } = await sb
    .from('jobs')
    .select('id, title, status, scheduled_for, created_at, template_id, notes, address')
    .eq('client_id', typedId)
    .order('created_at', { ascending: false });
  if (jobsErr) throw new Error(jobsErr.message);

  const jobIds = (jobs ?? []).map((job) => job.id);

  let reports: ReportRow[] = [];
  if (jobIds.length) {
    const { data: reportRows, error: reportErr } = await sb
      .from('reports')
      .select('id, job_id, storage_path, generated_at, created_at, updated_at')
      .in('job_id', jobIds as ReportRow['job_id'][]);
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

  const id = payload instanceof FormData ? payload.get('id') : (payload as any)?.id;
  ClientId.parse(id);

  const readClient = await supabaseServerReadOnly();
  const {
    data: { user },
    error,
  } = await readClient.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');

  const sb = await supabaseServerServiceRole();
  let lastErr: PostgrestError | null = null;

  for (const table of CLIENT_TABLES) {
    const updates =
      table === 'clients'
        ? {
            name: body.name,
            organization: body.organization ?? null,
            email: body.email ?? null,
            phone: body.phone ?? null,
            address: body.address ?? null,
            updated_at: new Date().toISOString(),
          }
        : {
            name: body.name,
            email: body.email ?? null,
            phone: body.phone ?? null,
            address: body.address ?? null,
          };

    const { error: updateErr, count } = await (sb as any)
      .from(table)
      .update(updates)
      .eq('id', id as string)
      .eq('user_id', user.id)
      .select('id', { count: 'exact', head: true });

    if (updateErr) {
      if (updateErr.code === '42P01') {
        lastErr = updateErr;
        continue;
      }
      throw new Error(updateErr.message);
    }

    if (count && count > 0) {
      revalidatePath('/clients');
      revalidatePath(`/clients/${id}`);
      return { id };
    }
  }

  throw new Error(lastErr?.message ?? 'Unable to update client');
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
  const tables = CLIENT_TABLES;
  let lastErr: PostgrestError | null = null;

  for (const table of tables) {
    const { error: delErr } = await (sb as any)
      .from(table)
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (delErr) {
      if (delErr.code === '42P01') {
        lastErr = delErr;
        continue;
      }
      throw new Error(delErr.message);
    }
  }

  if (lastErr) throw new Error(lastErr.message);

  revalidatePath('/clients');
}
