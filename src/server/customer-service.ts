'use server';
// Customers: jobs.client_id is the canonical link to public.clients. job_fields may mirror values but clients is the source of truth.

import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import { supabaseServerReadOnly, supabaseServerServiceRole } from '@/lib/supabaseServer';

export type Customer = {
  id: string;
  name: string;
  organization: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ClientRow = Database['public']['Tables']['clients']['Row'];
type JobRow = Database['public']['Tables']['jobs']['Row'];

const CustomerId = z.string().uuid();

const toText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const pickText = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return '';
};

function normalizeCustomer(row: ClientRow): Customer {
  return {
    id: row.id,
    name: row.name ?? '',
    organization: row.organization ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    address: row.address ?? null,
    user_id: row.user_id ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

async function resolveUserId(
  sb: SupabaseClient<Database>,
  label: string,
  userIdOverride?: string | null,
): Promise<string | null> {
  if (userIdOverride) return userIdOverride;
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error) throw new Error(error.message);
  if (!user) return null;
  return user.id;
}

export async function getCustomerById(
  customerId: string,
  options: { sb?: SupabaseClient<Database>; userId?: string | null; requireOwner?: boolean } = {},
): Promise<Customer | null> {
  CustomerId.parse(customerId);
  const sb = options.sb ?? (await supabaseServerReadOnly());
  const userId = await resolveUserId(sb, 'getCustomerById', options.userId);
  const requireOwner = options.requireOwner ?? Boolean(userId);

  const { data, error } = await sb
    .from('clients')
    .select('id, name, organization, email, phone, address, user_id, created_at, updated_at')
    .eq('id', customerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  if (requireOwner && userId && data.user_id && data.user_id !== userId) {
    throw new Error('Unauthorized');
  }
  return normalizeCustomer(data);
}

export async function searchCustomers(
  query: string,
  options: { sb?: SupabaseClient<Database>; userId?: string | null } = {},
): Promise<Customer[]> {
  const term = query.trim();
  if (!term) return [];
  const sb = options.sb ?? (await supabaseServerReadOnly());
  const userId = await resolveUserId(sb, 'searchCustomers', options.userId);
  if (!userId) throw new Error('Unauthorized');

  const like = `%${term}%`;
  const { data, error } = await sb
    .from('clients')
    .select('id, name, organization, email, phone, address, user_id, created_at, updated_at')
    .eq('user_id', userId)
    .or(`name.ilike.${like},organization.ilike.${like},email.ilike.${like},phone.ilike.${like}`);
  if (error) throw new Error(error.message);
  return (data ?? []).map(normalizeCustomer);
}

export async function resolveCustomerFromId(params: {
  customerId: string;
  sb?: SupabaseClient<Database>;
  userId?: string | null;
}) {
  CustomerId.parse(params.customerId);
  const sb = params.sb ?? (await supabaseServerServiceRole());
  const userId = await resolveUserId(sb, 'resolveCustomerFromId', params.userId);
  if (!userId) throw new Error('Unauthorized');

  const existing = await getCustomerById(params.customerId, { sb, userId, requireOwner: false });
  if (existing) {
    return { customer: existing, created: false };
  }

  return { customer: null, created: false };
}

export async function upsertCustomerFromJobFields(params: {
  jobId: string;
  fields: Record<string, unknown>;
  sb?: SupabaseClient<Database>;
  userId?: string | null;
}) {
  const sb = params.sb ?? (await supabaseServerServiceRole());
  const userId = await resolveUserId(sb, 'upsertCustomerFromJobFields', params.userId);
  if (!userId) throw new Error('Unauthorized');

  const { data: job, error: jobErr } = await sb
    .from('jobs')
    .select('id, user_id, client_id, client_name, address')
    .eq('id', params.jobId)
    .maybeSingle();
  if (jobErr || !job) throw new Error(jobErr?.message ?? 'Job not found');
  if (job.user_id && job.user_id !== userId) throw new Error('Unauthorized');

  const name = pickText(toText(params.fields.customer_name), toText(params.fields.client_name), job.client_name ?? null);
  const address = pickText(
    toText(params.fields.customer_address),
    toText(params.fields.billing_address),
    toText(params.fields.client_address),
  );
  const email = pickText(toText(params.fields.customer_email), toText(params.fields.email));
  const phone = pickText(toText(params.fields.customer_phone), toText(params.fields.phone));
  const organization = pickText(toText(params.fields.customer_company), toText(params.fields.organization));

  if (!name && !address && !email && !phone) {
    return { customer: null, created: false, updated: false, linked: false };
  }

  let customer: Customer | null = null;
  let created = false;
  let updated = false;
  let linked = false;

  if (job.client_id) {
    const updatePayload: Partial<ClientRow> = {};
    if (name) updatePayload.name = name;
    if (address) updatePayload.address = address;
    if (email) updatePayload.email = email;
    if (phone) updatePayload.phone = phone;
    if (organization) updatePayload.organization = organization;

    if (Object.keys(updatePayload).length) {
      const { data, error } = await sb
        .from('clients')
        .update(updatePayload)
        .eq('id', job.client_id)
        .select('id, name, organization, email, phone, address, user_id, created_at, updated_at')
        .single();
      if (error) throw new Error(error.message);
      customer = normalizeCustomer(data);
      updated = true;
    } else {
      customer = await getCustomerById(job.client_id, { sb, userId, requireOwner: false });
    }
  } else {
    const { data, error } = await sb
      .from('clients')
      .insert({
        name: name || 'Customer',
        organization: organization || null,
        email: email || null,
        phone: phone || null,
        address: address || null,
        user_id: userId,
      })
      .select('id, name, organization, email, phone, address, user_id, created_at, updated_at')
      .single();
    if (error || !data) throw new Error(error?.message ?? 'Unable to create customer');
    customer = normalizeCustomer(data);
    created = true;
    linked = true;

    const jobUpdates: Partial<JobRow> = {
      client_id: customer.id,
      client_name: name || customer.name,
    };
    await sb.from('jobs').update(jobUpdates).eq('id', params.jobId);
  }

  if (customer && !linked) {
    const jobUpdates: Partial<JobRow> = {};
    if (name && job.client_name !== name) jobUpdates.client_name = name;
    if (Object.keys(jobUpdates).length) {
      await sb.from('jobs').update(jobUpdates).eq('id', params.jobId);
    }
  }

  return { customer, created, updated, linked };
}