'use server';

import { supabaseServerAction } from '@/lib/supabaseServer';

export type InvoiceRow = {
  id: string;
  user_id: string;
  job_id: string;
  client_id: string | null;
  client_name_override?: string | null;
  client_address_override?: string | null;
  client_email_override?: string | null;
  client_phone_override?: string | null;
  invoice_number: string;
  currency: string;
  vat_rate: number | string | null;
  status: string;
  issue_date: string | null;
  due_date: string | null;
  notes: string | null;
  pdf_path?: string | null;
  created_at: string;
  updated_at: string;
};

export type InvoiceLineItemRow = {
  id: string;
  invoice_id: string;
  position: number;
  description: string;
  quantity: number;
  unit_price: number;
  vat_exempt: boolean;
  created_at: string;
};

export type InvoiceLineItemInput = {
  description: string;
  quantity?: number;
  unit_price?: number;
  vat_exempt?: boolean;
  position?: number;
};

export type InvoiceMetaInput = {
  status?: string;
  issue_date?: string | null;
  due_date?: string | null;
  notes?: string | null;
  vat_rate?: number | null;
  client_name_override?: string | null;
  client_address_override?: string | null;
  client_email_override?: string | null;
  client_phone_override?: string | null;
};

const getAuthedClient = async () => {
  const sb = await supabaseServerAction();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? 'Unauthorized');
  return { sb, user };
};

type UntypedQuery = {
  select: (columns?: string) => UntypedQuery;
  insert: (payload: Record<string, unknown> | Array<Record<string, unknown>>) => UntypedQuery;
  update: (payload: Record<string, unknown>) => UntypedQuery;
  delete: () => UntypedQuery;
  eq: (column: string, value: unknown) => UntypedQuery;
  in: (column: string, values: unknown[]) => UntypedQuery;
  order: (column: string, options?: { ascending?: boolean }) => UntypedQuery;
  maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
  single: () => Promise<{ data: unknown; error: { message: string } | null }>;
};
type UntypedSupabase = { from: (table: string) => UntypedQuery };

const fromInvoices = (sb: Awaited<ReturnType<typeof supabaseServerAction>>) =>
  (sb as unknown as UntypedSupabase).from('invoices');

const fromInvoiceLineItems = (sb: Awaited<ReturnType<typeof supabaseServerAction>>) =>
  (sb as unknown as UntypedSupabase).from('invoice_line_items');

const buildInvoiceNumber = (invoiceId: string) => {
  const year = new Date().getFullYear();
  const shortId = invoiceId.slice(0, 6).toUpperCase();
  return `INV-${year}-${shortId}`;
};

export async function createInvoiceForJob(jobId: string) {
  const { sb, user } = await getAuthedClient();

  const { data: job, error: jobErr } = await sb
    .from('jobs')
    .select('id, client_id')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (jobErr || !job) throw new Error(jobErr?.message ?? 'Job not found');

  const { data: created, error: insertErr } = await fromInvoices(sb)
    .insert({
      user_id: user.id,
      job_id: jobId,
      client_id: job.client_id,
      invoice_number: 'INV-PENDING',
    })
    .select('*')
    .maybeSingle();
  if (insertErr || !created) throw new Error(insertErr?.message ?? 'Unable to create invoice');

  const createdRow = created as { id: string };
  const invoiceNumber = buildInvoiceNumber(createdRow.id);
  const { data: updated, error: updateErr } = await fromInvoices(sb)
    .update({ invoice_number: invoiceNumber })
    .eq('id', createdRow.id)
    .select('*')
    .maybeSingle();
  if (updateErr || !updated) throw new Error(updateErr?.message ?? 'Unable to set invoice number');

  return updated as InvoiceRow;
}

export async function getInvoice(invoiceId: string) {
  const { sb, user } = await getAuthedClient();

  const { data: invoice, error: invoiceErr } = await fromInvoices(sb)
    .select('*')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (invoiceErr || !invoice) throw new Error(invoiceErr?.message ?? 'Invoice not found');

  const { data: lineItems, error: itemsErr } = await (fromInvoiceLineItems(sb)
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('position', { ascending: true }) as unknown as Promise<{ data: InvoiceLineItemRow[] | null; error: { message: string } | null }>);
  if (itemsErr) throw new Error(itemsErr.message);

  return {
    invoice: invoice as InvoiceRow,
    lineItems: (lineItems ?? []) as InvoiceLineItemRow[],
  };
}

export async function listInvoicesForJob(jobId: string) {
  const { sb, user } = await getAuthedClient();
  const { data, error } = await (fromInvoices(sb)
    .select('*')
    .eq('job_id', jobId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false }) as unknown as Promise<{ data: InvoiceRow[] | null; error: { message: string } | null }>);
  if (error) throw new Error(error.message);
  return (data ?? []) as InvoiceRow[];
}

export async function upsertLineItems(invoiceId: string, items: InvoiceLineItemInput[]) {
  const { sb, user } = await getAuthedClient();

  const { data: invoice, error: invoiceErr } = await fromInvoices(sb)
    .select('id')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (invoiceErr || !invoice) throw new Error(invoiceErr?.message ?? 'Invoice not found');

  const { error: deleteErr } = await (fromInvoiceLineItems(sb).delete().eq('invoice_id', invoiceId) as unknown as Promise<{
    error: { message: string } | null;
  }>);
  if (deleteErr) throw new Error(deleteErr.message);

  if (!items.length) return [];

  const rows = items.map((item, index) => ({
    invoice_id: invoiceId,
    position: item.position ?? index,
    description: item.description,
    quantity: item.quantity ?? 1,
    unit_price: item.unit_price ?? 0,
    vat_exempt: item.vat_exempt ?? false,
  }));

  const { data: inserted, error: insertErr } = await (fromInvoiceLineItems(sb)
    .insert(rows)
    .select('*')
    .order('position', { ascending: true }) as unknown as Promise<{ data: InvoiceLineItemRow[] | null; error: { message: string } | null }>);
  if (insertErr) throw new Error(insertErr.message);

  return (inserted ?? []) as InvoiceLineItemRow[];
}

export async function setInvoiceMeta(invoiceId: string, meta: InvoiceMetaInput) {
  const { sb, user } = await getAuthedClient();

  const updates: Record<string, unknown> = {};
  if (meta.status !== undefined) updates.status = meta.status;
  if (meta.issue_date !== undefined) updates.issue_date = meta.issue_date;
  if (meta.due_date !== undefined) updates.due_date = meta.due_date;
  if (meta.notes !== undefined) updates.notes = meta.notes;
  if (meta.vat_rate !== undefined) updates.vat_rate = meta.vat_rate;
  if (meta.client_name_override !== undefined) updates.client_name_override = meta.client_name_override;
  if (meta.client_address_override !== undefined) updates.client_address_override = meta.client_address_override;
  if (meta.client_email_override !== undefined) updates.client_email_override = meta.client_email_override;
  if (meta.client_phone_override !== undefined) updates.client_phone_override = meta.client_phone_override;

  const { data, error } = await fromInvoices(sb)
    .update(updates)
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .select('*')
    .maybeSingle();
  if (error || !data) throw new Error(error?.message ?? 'Unable to update invoice');

  return data as InvoiceRow;
}
