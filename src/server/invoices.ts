'use server';

import { supabaseServerAction } from '@/lib/supabaseServer';
import { isEmailConfigured, sendEmail } from '@/lib/resend';
import {
  baseEmail,
  ctaButton,
  emailSubtitle,
  emailTitle,
  formatDate,
  formatSortCode,
  infoCard,
  joinAddress,
  titleCase,
} from '@/lib/email-templates';
import {
  STANDARD_RATE_DESCRIPTIONS,
  normalizeStandardRates,
  type StandardRates,
} from '@/lib/standard-rates';
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
  payment_link_url?: string | null;
  payment_status?: string | null;
  issue_date: string | null;
  due_date: string | null;
  sent_at?: string | null;
  public_visible?: boolean | null;
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
  gas_service: 'Boiler Service Record',
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

const fromProfiles = (sb: Awaited<ReturnType<typeof supabaseServerAction>>) =>
  (sb as unknown as UntypedSupabase).from('profiles');

async function sendEmailSafely(context: string, input: Parameters<typeof sendEmail>[0]) {
  if (!isEmailConfigured()) return { status: 'not_configured' as const };
  try {
    const result = await sendEmail(input);
    if (result.status !== 'sent') console.error(`[${context}] email failed:`, result.error ?? result.status);
    return result;
  } catch (error) {
    console.error(`[${context}] email failed:`, error);
    return { status: 'failed' as const, error: error instanceof Error ? error.message : 'Unknown email error' };
  }
}

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

async function resolveInvoiceCertificateTypes(params: {
  sb: Awaited<ReturnType<typeof supabaseServerAction>>;
  jobId: string;
  jobCertificateType?: string | null;
}) {
  const types = new Set<string>();
  const normalizedJobType = typeof params.jobCertificateType === 'string' ? params.jobCertificateType.trim() : '';
  if (normalizedJobType) types.add(normalizedJobType);

  const { data: certificates, error } = await (params.sb
    .from('certificates')
    .select('cert_type, created_at')
    .eq('job_id', params.jobId)
    .order('created_at', { ascending: true }) as unknown as Promise<{
    data: Array<{ cert_type?: string | null }> | null;
    error: { message: string } | null;
  }>);
  if (error) throw new Error(error.message);

  (certificates ?? []).forEach((certificate) => {
    const type = typeof certificate.cert_type === 'string' ? certificate.cert_type.trim() : '';
    if (type) types.add(type);
  });

  if (!types.size) {
    const fallback = await resolveInvoiceCertificateType(params);
    if (fallback) types.add(fallback);
  }

  return Array.from(types);
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

async function getStandardRatesForUser(params: {
  sb: Awaited<ReturnType<typeof supabaseServerAction>>;
  userId: string;
}) {
  const { data, error } = await (fromProfiles(params.sb)
    .select('standard_rates')
    .eq('id', params.userId)
    .maybeSingle() as unknown as Promise<{
    data: { standard_rates?: unknown } | null;
    error: { code?: string; message: string } | null;
  }>);

  if (error) {
    if (error.code === '42703' || /standard_rates/i.test(error.message)) return {};
    throw new Error(error.message);
  }

  return normalizeStandardRates(data?.standard_rates);
}

function getStandardRateForCertificateType(certificateType: string, standardRates: StandardRates) {
  if (certificateType === 'cp12') return standardRates.cp12 ?? null;
  if (certificateType === 'gas_service') return standardRates.boiler_service ?? null;
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

  const certificateTypes = await resolveInvoiceCertificateTypes({
    sb,
    jobId,
    jobCertificateType: job.certificate_type,
  });
  const standardRates = await getStandardRatesForUser({ sb, userId: user.id });

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

  const lineItems: Array<{
    invoice_id: string;
    position: number;
    description: string;
    quantity: number;
    unit_price: number;
    vat_exempt: boolean;
  }> = [];
  const pendingCertificateTypes = [...certificateTypes];
  const hasCp12AndBoiler = pendingCertificateTypes.includes('cp12') && pendingCertificateTypes.includes('gas_service');
  if (hasCp12AndBoiler && standardRates.cp12_boiler_service) {
    lineItems.push({
      invoice_id: createdRow.id,
      position: lineItems.length,
      description: STANDARD_RATE_DESCRIPTIONS.cp12_boiler_service,
      quantity: 1,
      unit_price: standardRates.cp12_boiler_service,
      vat_exempt: false,
    });
    pendingCertificateTypes.splice(pendingCertificateTypes.indexOf('cp12'), 1);
    pendingCertificateTypes.splice(pendingCertificateTypes.indexOf('gas_service'), 1);
  }

  for (const certificateType of pendingCertificateTypes) {
    const defaultDescription = INVOICE_DEFAULT_LINE_ITEM_BY_CERTIFICATE_TYPE[certificateType as CertificateType] ?? null;
    if (!defaultDescription) continue;
    const standardRate = getStandardRateForCertificateType(certificateType, standardRates);
    const lastUsedUnitPrice =
      standardRate ?? (await findLastUsedUnitPriceForCertificateType({ sb, userId: user.id, certificateType }));
    lineItems.push({
      invoice_id: createdRow.id,
      position: lineItems.length,
      description: defaultDescription,
      quantity: 1,
      unit_price: lastUsedUnitPrice ?? 0,
      vat_exempt: false,
    });
  }

  if (lineItems.length) {
    const { error: lineItemErr } = await (fromInvoiceLineItems(sb)
      .insert(lineItems) as unknown as Promise<{ error: { message: string } | null }>);
    if (lineItemErr) throw new Error(lineItemErr.message);
  }

  return updated as InvoiceRow;
}

export async function createBlankInvoice(input?: { clientId?: string | null }) {
  const { sb, user } = await getAuthedClient();

  const clientId = input?.clientId?.trim() || null;
  let client: { name?: string | null; address?: string | null; postcode?: string | null; email?: string | null; phone?: string | null } | null = null;
  if (clientId) {
    const { data, error } = await sb
      .from('clients')
      .select('id, name, address, postcode, email, phone')
      .eq('id', clientId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Client not found');
    client = data;
  }

  const clientAddressOverride = client
    ? [client.address, client.postcode]
        .map((part) => String(part ?? '').trim())
        .filter(Boolean)
        .filter((part, idx, arr) => arr.indexOf(part) === idx)
        .join(', ') || null
    : null;

  const { data: created, error: insertErr } = await fromInvoices(sb)
    .insert({
      user_id: user.id,
      job_id: null,
      client_id: clientId,
      client_name_override: client?.name ?? null,
      client_address_override: clientAddressOverride,
      client_email_override: client?.email ?? null,
      client_phone_override: client?.phone ?? null,
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

export async function sendInvoiceEmail(invoiceId: string, toEmail: string, pdfUrl: string) {
  const { sb, user } = await getAuthedClient();

  const { data: invoice, error: invoiceErr } = await fromInvoices(sb)
    .select('id, invoice_number, job_id, issue_date, due_date, client_address_override')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (invoiceErr || !invoice) throw new Error(invoiceErr?.message ?? 'Invoice not found');

  const invoiceRow = invoice as {
    id: string;
    invoice_number: string;
    job_id: string | null;
    issue_date: string | null;
    due_date: string | null;
    client_address_override?: string | null;
  };
  const { data: profileData } = await (fromProfiles(sb)
    .select('full_name, company_name, company_email, bank_name, bank_account_name, bank_sort_code, bank_account_number')
    .eq('id', user.id)
    .maybeSingle() as Promise<{ data: unknown; error: { message: string } | null }>);
  const { data: jobData } = invoiceRow.job_id
    ? await ((sb as unknown as UntypedSupabase)
        .from('jobs')
        .select('address, job_type')
        .eq('id', invoiceRow.job_id)
        .maybeSingle() as Promise<{ data: unknown; error: { message: string } | null }>)
    : { data: null };
  const { data: lineItems } = await (fromInvoiceLineItems(sb)
    .select('description, quantity, unit_price')
    .eq('invoice_id', invoiceId) as unknown as Promise<{ data: unknown[] | null; error: { message: string } | null }>);
  const profile = (profileData ?? {}) as Record<string, string | null>;
  const job = (jobData ?? {}) as Record<string, string | null>;
  const rows = (lineItems ?? []) as Array<{ description?: string | null; quantity?: number | string | null; unit_price?: number | string | null }>;
  const total = rows.reduce((sum, row) => sum + Number(row.quantity ?? 1) * Number(row.unit_price ?? 0), 0);
  const companyName = titleCase(profile.company_name || profile.full_name || 'CertNow engineer');
  const address = joinAddress([invoiceRow.client_address_override, job.address], 'the property');
  const work = rows.map((row) => row.description).filter(Boolean).join(', ') || job.job_type || 'Gas safety work';
  const subject = `Invoice ${invoiceRow.invoice_number} from ${companyName}`;

  return sendEmailSafely('sendInvoiceEmail', {
    to: toEmail,
    subject,
    replyTo: profile.company_email || undefined,
    html: baseEmail(
      [
        emailTitle(`Invoice from ${companyName}`),
        emailSubtitle(`Please find your invoice for gas safety work at ${address}.`),
        infoCard('Invoice summary', [
          { label: 'Invoice no.', value: invoiceRow.invoice_number },
          { label: 'Property', value: address },
          { label: 'Work', value: work },
          { label: 'Issued', value: invoiceRow.issue_date ? formatDate(invoiceRow.issue_date) : 'Not provided' },
          { label: 'Due', value: invoiceRow.due_date ? formatDate(invoiceRow.due_date) : 'Not provided' },
          { label: 'Amount due', value: `£${total.toFixed(2)}` },
        ]),
        infoCard('How to pay', [
          { label: 'Pay to', value: profile.bank_account_name || profile.company_name || 'Not provided' },
          { label: 'Bank', value: profile.bank_name || 'Not provided' },
          { label: 'Sort code', value: profile.bank_sort_code ? formatSortCode(profile.bank_sort_code) : 'Not provided' },
          { label: 'Account', value: profile.bank_account_number || 'Not provided' },
          { label: 'Reference', value: invoiceRow.invoice_number },
        ]),
        ctaButton('View invoice', pdfUrl, 'dark'),
      ].join(''),
      { subject, sentOnBehalfOf: companyName },
    ),
    text: [
      'Hi,',
      '',
      `Please find your invoice for gas safety work at ${address}.`,
      '',
      `Invoice no.: ${invoiceRow.invoice_number}`,
      `Work: ${work}`,
      `Issued: ${invoiceRow.issue_date ? formatDate(invoiceRow.issue_date) : 'Not provided'}`,
      `Due: ${invoiceRow.due_date ? formatDate(invoiceRow.due_date) : 'Not provided'}`,
      `Amount due: £${total.toFixed(2)}`,
      '',
      pdfUrl,
      '',
      `Kind regards,\n${companyName}`,
    ].join('\n'),
  });
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
