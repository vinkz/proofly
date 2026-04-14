'use server';

import { supabaseServerAction } from '@/lib/supabaseServer';
import type { CertificateType } from '@/types/certificates';

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

const INVOICE_DEFAULT_LINE_ITEM_BY_CERTIFICATE_TYPE: Partial<Record<CertificateType, string>> = {
  cp12: 'Gas Safety Certificate (CP12)',
  gas_warning_notice: 'Gas Warning Notice Inspection',
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

async function resolveInvoiceCertificateType(params: {
  sb: Awaited<ReturnType<typeof supabaseServerAction>>;
  jobId: string;
  jobCertificateType?: string | null;
}) {
  const normalizedJobType = typeof params.jobCertificateType === 'string' ? params.jobCertificateType.trim() : '';
  if (normalizedJobType) return normalizedJobType;

  const { data: certificate } = await (params.sb
    .from('certificates')
    .select('cert_type, created_at')
    .eq('job_id', params.jobId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle() as unknown as Promise<{ data: { cert_type?: string | null } | null; error: { message: string } | null }>);

  return typeof certificate?.cert_type === 'string' ? certificate.cert_type : '';
}

async function findLastUsedUnitPriceForCertificateType(params: {
  sb: Awaited<ReturnType<typeof supabaseServerAction>>;
  userId: string;
  certificateType: string;
}) {
  const { sb, userId, certificateType } = params;
  if (!certificateType) return null;

  const { data: invoices, error: invoicesErr } = await (fromInvoices(sb)
    .select('id, job_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false }) as unknown as Promise<{
    data: Array<{ id: string; job_id: string | null }> | null;
    error: { message: string } | null;
  }>);
  if (invoicesErr) throw new Error(invoicesErr.message);

  const invoiceRows = invoices ?? [];
  const jobIds = invoiceRows.map((invoice) => invoice.job_id).filter((value): value is string => Boolean(value));
  if (!jobIds.length) return null;

  const { data: jobs, error: jobsErr } = await sb
    .from('jobs')
    .select('id, certificate_type')
    .in('id', jobIds);
  if (jobsErr) throw new Error(jobsErr.message);

  const jobTypeById = new Map<string, string>();
  (jobs ?? []).forEach((job) => {
    if (job.id && job.certificate_type) {
      jobTypeById.set(job.id, job.certificate_type);
    }
  });

  const unresolvedJobIds = jobIds.filter((jobId) => !jobTypeById.has(jobId));
  if (unresolvedJobIds.length) {
    const { data: certificates, error: certErr } = await (sb
      .from('certificates')
      .select('job_id, cert_type, created_at')
      .in('job_id', unresolvedJobIds)
      .order('created_at', { ascending: false }) as unknown as Promise<{
      data: Array<{ job_id?: string | null; cert_type?: string | null }> | null;
      error: { message: string } | null;
    }>);
    if (certErr) throw new Error(certErr.message);
    (certificates ?? []).forEach((certificate) => {
      if (certificate.job_id && certificate.cert_type && !jobTypeById.has(certificate.job_id)) {
        jobTypeById.set(certificate.job_id, certificate.cert_type);
      }
    });
  }

  const matchingInvoiceIds = invoiceRows
    .filter((invoice) => invoice.job_id && jobTypeById.get(invoice.job_id) === certificateType)
    .map((invoice) => invoice.id);
  if (!matchingInvoiceIds.length) return null;

  const { data: lineItems, error: lineItemsErr } = await (fromInvoiceLineItems(sb)
    .select('unit_price, created_at')
    .in('invoice_id', matchingInvoiceIds)
    .order('created_at', { ascending: false }) as unknown as Promise<{
    data: Array<{ unit_price?: number | string | null }> | null;
    error: { message: string } | null;
  }>);
  if (lineItemsErr) throw new Error(lineItemsErr.message);

  for (const item of lineItems ?? []) {
    const unitPrice = Number(item.unit_price ?? 0);
    if (Number.isFinite(unitPrice) && unitPrice > 0) {
      return unitPrice;
    }
  }

  return null;
}

export async function createInvoiceForJob(jobId: string) {
  const { sb, user } = await getAuthedClient();

  const { data: job, error: jobErr } = await sb
    .from('jobs')
    .select('id, client_id, certificate_type')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (jobErr || !job) throw new Error(jobErr?.message ?? 'Job not found');

  const certificateType = await resolveInvoiceCertificateType({
    sb,
    jobId,
    jobCertificateType: job.certificate_type,
  });

  const { data: created, error: insertErr } = await fromInvoices(sb)
    .insert({
      user_id: user.id,
      job_id: jobId,
      client_id: job.client_id,
      invoice_number: 'INV-PENDING',
      vat_rate: 0.2,
      status: 'draft',
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

  const defaultDescription =
    INVOICE_DEFAULT_LINE_ITEM_BY_CERTIFICATE_TYPE[certificateType as CertificateType] ?? null;
  if (defaultDescription) {
    const lastUsedUnitPrice = await findLastUsedUnitPriceForCertificateType({
      sb,
      userId: user.id,
      certificateType,
    });
    const { error: lineItemErr } = await (fromInvoiceLineItems(sb)
      .insert({
        invoice_id: createdRow.id,
        position: 0,
        description: defaultDescription,
        quantity: 1,
        unit_price: lastUsedUnitPrice ?? 0,
        vat_exempt: false,
      }) as unknown as Promise<{ error: { message: string } | null }>);
    if (lineItemErr) throw new Error(lineItemErr.message);
  }

  return updated as InvoiceRow;
}

export async function listInvoices() {
  const { sb, user } = await getAuthedClient();
  const { data, error } = await (fromInvoices(sb)
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false }) as unknown as Promise<{ data: InvoiceRow[] | null; error: { message: string } | null }>);
  if (error) throw new Error(error.message);
  return (data ?? []) as InvoiceRow[];
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
