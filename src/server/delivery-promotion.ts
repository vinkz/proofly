'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';

import { formatAddressLine } from '@/lib/address';
import type { Database } from '@/lib/database.types';
import { supabaseServerServiceRole } from '@/lib/supabaseServer';

type JobRow = Pick<
  Database['public']['Tables']['jobs']['Row'],
  | 'id'
  | 'user_id'
  | 'client_id'
  | 'client_name'
  | 'address'
  | 'job_type'
  | 'certificate_type'
  | 'cert_types'
  | 'scheduled_for'
  | 'delivered_at'
  | 'completed_at'
  | 'created_at'
  | 'property_id'
>;
type ClientRow = Database['public']['Tables']['clients']['Row'];
type ClientInsert = Database['public']['Tables']['clients']['Insert'];
type ClientUpdate = Database['public']['Tables']['clients']['Update'];
type PropertyInsert = Database['public']['Tables']['properties']['Insert'];
type PropertyUpdate = Database['public']['Tables']['properties']['Update'];
type JobFieldRow = Pick<Database['public']['Tables']['job_fields']['Row'], 'field_key' | 'value'>;

const pickText = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return null;
};

const normalizeKey = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase();
const normalizePhone = (value: string | null | undefined) => String(value ?? '').replace(/\D/g, '');

const splitAddressParts = (value: string | null | undefined) =>
  String(value ?? '')
    .split(/[\r\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean);

const normalizeDateOnly = (value: string | null | undefined) => {
  if (!value) return null;
  const direct = value.trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const addOneYear = (value: string | null | undefined) => {
  const dateOnly = normalizeDateOnly(value);
  if (!dateOnly) return null;
  const parsed = new Date(`${dateOnly}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setUTCFullYear(parsed.getUTCFullYear() + 1);
  return parsed.toISOString().slice(0, 10);
};

const isCp12Job = (job: JobRow) => {
  const certTypes = Array.isArray(job.cert_types) ? job.cert_types : [];
  return (
    job.job_type === 'safety_check' ||
    job.job_type === 'safety_check_service' ||
    job.certificate_type === 'cp12' ||
    certTypes.includes('cp12')
  );
};

const toFieldMap = (rows: JobFieldRow[]) =>
  rows.reduce<Record<string, string>>((acc, row) => {
    const key = row.field_key ?? '';
    const value = row.value?.trim() ?? '';
    if (key && value) acc[key] = value;
    return acc;
  }, {});

const buildLandlordAddress = (fields: Record<string, string>, fallback: string | null | undefined) =>
  pickText(
    fields.landlord_address,
    formatAddressLine({
      line1: fields.landlord_address_line1,
      line2: fields.landlord_address_line2,
      town: fields.landlord_city,
      postcode: fields.landlord_postcode,
    }),
    fallback,
  );

const buildPropertyAddressParts = (fields: Record<string, string>, jobAddress: string | null | undefined) => {
  const legacyParts = splitAddressParts(jobAddress);
  const postcode = pickText(fields.job_postcode, fields.property_postcode, fields.postcode);
  const withoutPostcode = postcode
    ? legacyParts.filter((part) => normalizeKey(part) !== normalizeKey(postcode))
    : legacyParts;

  return {
    name: pickText(fields.job_address_name, fields.property_name),
    line1: pickText(fields.job_address_line1, fields.property_address_line1, withoutPostcode[0]),
    line2: pickText(
      fields.job_address_line2,
      fields.property_address_line2,
      withoutPostcode.length > 2 ? withoutPostcode.slice(1, -1).join(', ') : null,
    ),
    town: pickText(fields.job_address_city, fields.property_town, withoutPostcode.length > 1 ? withoutPostcode.at(-1) : null),
    postcode: pickText(postcode, legacyParts.at(-1)),
    phone: pickText(fields.job_tel, fields.property_phone, fields.tenant_phone),
  };
};

async function upsertClient(params: {
  sb: SupabaseClient<Database>;
  job: JobRow;
  fields: Record<string, string>;
  userId: string;
}) {
  const { sb, job, fields, userId } = params;
  const name = pickText(fields.landlord_name, fields.customer_name, job.client_name, 'Landlord');
  const email = pickText(fields.landlord_email, fields.customer_email, fields.email);
  const phone = pickText(fields.landlord_tel, fields.landlord_phone, fields.customer_phone, fields.phone);
  const organization = pickText(fields.landlord_company, fields.customer_company);
  const landlordAddress = buildLandlordAddress(fields, null);
  const postcode = pickText(fields.landlord_postcode, fields.customer_postcode);

  if (!name && !email && !phone) return null;

  let existing: ClientRow | null = null;
  if (job.client_id) {
    const { data, error } = await sb
      .from('clients')
      .select('id, name, organization, email, phone, address, postcode, landlord_name, landlord_address, user_id, created_at, updated_at')
      .eq('id', job.client_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    existing = data;
  }

  if (!existing && (email || phone)) {
    const { data, error } = await sb
      .from('clients')
      .select('id, name, organization, email, phone, address, postcode, landlord_name, landlord_address, user_id, created_at, updated_at')
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    const normalizedEmail = normalizeKey(email);
    const normalizedPhone = normalizePhone(phone);
    existing =
      (data ?? []).find(
        (client) =>
          (normalizedEmail && normalizeKey(client.email) === normalizedEmail) ||
          (normalizedPhone && normalizePhone(client.phone) === normalizedPhone),
      ) ?? null;
  }

  if (existing) {
    const update: ClientUpdate = {
      name: name ?? existing.name,
      organization: organization ?? existing.organization,
      email: email ?? existing.email,
      phone: phone ?? existing.phone,
      address: landlordAddress ?? existing.address,
      postcode: postcode ?? existing.postcode,
      landlord_name: name ?? existing.landlord_name,
      landlord_address: landlordAddress ?? existing.landlord_address,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await sb
      .from('clients')
      .update(update)
      .eq('id', existing.id)
      .select('id, name, organization, email, phone, address, postcode, landlord_name, landlord_address, user_id, created_at, updated_at')
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  const insert: ClientInsert = {
    name: name ?? 'Landlord',
    organization,
    email,
    phone,
    address: landlordAddress,
    postcode,
    landlord_name: name,
    landlord_address: landlordAddress,
    user_id: userId,
  };
  const { data, error } = await sb
    .from('clients')
    .insert(insert)
    .select('id, name, organization, email, phone, address, postcode, landlord_name, landlord_address, user_id, created_at, updated_at')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function upsertProperty(params: {
  sb: SupabaseClient<Database>;
  job: JobRow;
  fields: Record<string, string>;
  userId: string;
  clientId: string | null;
}) {
  const { sb, job, fields, userId, clientId } = params;
  const property = buildPropertyAddressParts(fields, job.address);
  if (!property.line1 || !property.postcode) return null;

  const nextServiceDue = isCp12Job(job)
    ? addOneYear(
        pickText(fields.inspection_date, fields.completion_date, fields.issued_at) ??
          job.delivered_at ??
          job.completed_at ??
          job.scheduled_for ??
          job.created_at,
      )
    : null;

  const { data: candidates, error: candidatesErr } = await sb
    .from('properties')
    .select('id, user_id, client_id, public_token, name, address_line1, address_line2, town, postcode, phone, next_service_due, created_at, updated_at')
    .eq('user_id', userId)
    .eq('postcode', property.postcode);
  if (candidatesErr) throw new Error(candidatesErr.message);

  const existing =
    (candidates ?? []).find((row) => normalizeKey(row.address_line1) === normalizeKey(property.line1)) ??
    null;

  const payload: PropertyUpdate = {
    client_id: clientId ?? existing?.client_id ?? null,
    name: property.name ?? existing?.name ?? null,
    address_line1: property.line1,
    address_line2: property.line2 ?? existing?.address_line2 ?? null,
    town: property.town ?? existing?.town ?? null,
    postcode: property.postcode,
    phone: property.phone ?? existing?.phone ?? null,
    next_service_due: nextServiceDue ?? existing?.next_service_due ?? null,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await sb
      .from('properties')
      .update(payload)
      .eq('id', existing.id)
      .select('id, user_id, client_id, public_token, name, address_line1, address_line2, town, postcode, phone, next_service_due, created_at, updated_at')
      .single();
    if (error) throw new Error(error.message);
    // A newer next_service_due means a fresh certificate cycle, so the previous renewal lifecycle
    // (requested/booked/reminded) is satisfied — clear it so reminders start over for the new
    // period. Best-effort; cast because these columns aren't in the generated types yet.
    if (nextServiceDue && (!existing.next_service_due || nextServiceDue > existing.next_service_due)) {
      try {
        await sb
          .from('properties')
          .update({
            renewal_booked_at: null,
            renewal_booked_date: null,
            renewal_requested_at: null,
            renewal_last_reminded_at: null,
          } as never)
          .eq('id', existing.id);
      } catch (resetErr) {
        console.error('[delivery-promotion] failed to reset renewal lifecycle:', resetErr);
      }
    }
    return data;
  }

  const insert: PropertyInsert = {
    ...payload,
    user_id: userId,
  };
  const { data, error } = await sb
    .from('properties')
    .insert(insert)
    .select('id, user_id, client_id, public_token, name, address_line1, address_line2, town, postcode, phone, next_service_due, created_at, updated_at')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function promoteDeliveredJobData(params: {
  jobId: string;
  userId?: string | null;
  sb?: SupabaseClient<Database>;
}) {
  const sb = params.sb ?? (await supabaseServerServiceRole());
  const { data: job, error: jobErr } = await sb
    .from('jobs')
    .select('id, user_id, client_id, client_name, address, job_type, certificate_type, cert_types, scheduled_for, delivered_at, completed_at, created_at, property_id')
    .eq('id', params.jobId)
    .maybeSingle();
  if (jobErr) throw new Error(jobErr.message);
  if (!job?.id) throw new Error('Job not found');
  if (params.userId && job.user_id && job.user_id !== params.userId) throw new Error('Unauthorized');
  const userId = job.user_id ?? params.userId ?? null;
  if (!userId) throw new Error('Job owner not found');

  const { data: rows, error: fieldsErr } = await sb
    .from('job_fields')
    .select('field_key, value')
    .eq('job_id', params.jobId);
  if (fieldsErr) throw new Error(fieldsErr.message);
  const fields = toFieldMap(rows ?? []);

  const client = await upsertClient({ sb, job, fields, userId });
  const property = await upsertProperty({ sb, job, fields, userId, clientId: client?.id ?? job.client_id ?? null });

  const formattedPropertyAddress = property
    ? formatAddressLine({
        line1: property.address_line1 ?? undefined,
        line2: property.address_line2 ?? undefined,
        town: property.town ?? undefined,
        postcode: property.postcode ?? undefined,
      })
    : null;

  const jobUpdate: Database['public']['Tables']['jobs']['Update'] = {
    client_id: client?.id ?? job.client_id,
    client_name: client?.name ?? job.client_name,
    property_id: property?.id ?? job.property_id,
    address: formattedPropertyAddress ?? job.address,
    updated_at: new Date().toISOString(),
  };
  const { error: updateErr } = await sb.from('jobs').update(jobUpdate).eq('id', params.jobId);
  if (updateErr) throw new Error(updateErr.message);

  revalidatePath('/dashboard');
  revalidatePath('/jobs/new');
  revalidatePath('/properties');

  return {
    clientId: client?.id ?? job.client_id ?? null,
    propertyId: property?.id ?? job.property_id ?? null,
  };
}
