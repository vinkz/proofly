import { NextResponse } from 'next/server';

import { supabaseServerAction, supabaseServerServiceRole } from '@/lib/supabaseServer';
import { renderInvoicePdf } from '@/server/pdf/renderInvoicePdf';

type ProfileSummary = {
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  bank_name?: string | null;
  bank_sort_code?: string | null;
  full_name?: string | null;
  company_name?: string | null;
  company_address?: string | null;
  company_address_line2?: string | null;
  company_town?: string | null;
  company_postcode?: string | null;
  company_phone?: string | null;
  default_engineer_name?: string | null;
  default_engineer_id?: string | null;
  gas_safe_number?: string | null;
};

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  const { invoiceId } = await params;
  const sb = await supabaseServerAction();
  const {
    data: { user },
    error: authErr,
  } = await sb.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Invoices tables are not in the generated types yet; use an untyped handle.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anySb = sb as any;

  const { data: invoice, error: invoiceErr } = await anySb
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (invoiceErr || !invoice) {
    return NextResponse.json({ error: invoiceErr?.message ?? 'Invoice not found' }, { status: 404 });
  }

  const { data: lineItems, error: itemsErr } = await anySb
    .from('invoice_line_items')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('position', { ascending: true });
  if (itemsErr) {
    return NextResponse.json({ error: itemsErr.message }, { status: 500 });
  }

  const { data: job } = await sb
    .from('jobs')
    .select('id, client_id, client_name, address, title')
    .eq('id', invoice.job_id)
    .maybeSingle();

  const { data: client } = job?.client_id
    ? await sb
        .from('clients')
        .select('id, name, address, email, phone')
        .eq('id', job.client_id)
        .maybeSingle()
    : { data: null };

  const profileSelectVariants = [
    'full_name, company_name, company_address, company_address_line2, company_town, company_postcode, company_phone, default_engineer_name, default_engineer_id, gas_safe_number, bank_name, bank_account_name, bank_sort_code, bank_account_number',
    'full_name, company_name, company_address, company_address_line2, company_town, company_postcode, company_phone, default_engineer_name, default_engineer_id, gas_safe_number',
    'full_name, company_name, company_address, company_postcode, company_phone, default_engineer_name, default_engineer_id, gas_safe_number',
    'full_name, company_name, company_address, company_postcode, company_phone',
  ];
  let profile: ProfileSummary | null = null;
  for (const columns of profileSelectVariants) {
    const { data, error } = await sb.from('profiles').select(columns).eq('id', user.id).maybeSingle();
    if (error) {
      if (error.code === '42703') continue;
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    profile = (data ?? null) as ProfileSummary | null;
    break;
  }

  type InvoiceLineItem = {
    description?: string | null;
    quantity?: number | null;
    unit_price?: number | null;
    vat_exempt?: boolean | null;
  };
  const normalizedItems = (lineItems ?? []) as InvoiceLineItem[];

  const normalizeAddress = (value: string | null | undefined) =>
    String(value ?? '')
      .split(/[\r\n,]+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .join(', ');

  const companyAddress = [
    profile?.company_address ?? null,
    profile?.company_address_line2 ?? null,
    profile?.company_town ?? null,
    profile?.company_postcode ?? null,
  ]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(', ');

  const pdfBytes = await renderInvoicePdf({
    invoice_number: invoice.invoice_number ?? 'Invoice',
    status: invoice.status ?? 'draft',
    issue_date: invoice.issue_date,
    due_date: invoice.due_date,
    vat_rate: Number(invoice.vat_rate ?? 0),
    currency: invoice.currency ?? 'GBP',
    notes: invoice.notes ?? '',
    profile: {
      full_name: profile?.full_name ?? null,
      company_name: profile?.company_name ?? null,
      company_address: companyAddress || null,
      company_phone: profile?.company_phone ?? null,
      default_engineer_name: profile?.default_engineer_name ?? null,
      default_engineer_id: profile?.default_engineer_id ?? null,
      gas_safe_number: profile?.gas_safe_number ?? null,
      bank_name: profile?.bank_name ?? null,
      bank_account_name: profile?.bank_account_name ?? null,
      bank_sort_code: profile?.bank_sort_code ?? null,
      bank_account_number: profile?.bank_account_number ?? null,
    },
    client: {
      name: invoice.client_name_override ?? client?.name ?? job?.client_name ?? '',
      address: normalizeAddress(invoice.client_address_override ?? client?.address ?? null),
      email: invoice.client_email_override ?? client?.email ?? null,
      phone: invoice.client_phone_override ?? client?.phone ?? null,
    },
    job: {
      title: job?.title ?? null,
      address: normalizeAddress(job?.address ?? null),
    },
    lineItems: normalizedItems.map((item) => ({
      description: item.description ?? '',
      quantity: Number(item.quantity ?? 0),
      unit_price: Number(item.unit_price ?? 0),
      vat_exempt: Boolean(item.vat_exempt),
    })),
  });

  const admin = await supabaseServerServiceRole();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyAdmin = admin as any;
  const storagePath = `${user.id}/${invoiceId}.pdf`;
  const { error: uploadErr } = await anyAdmin.storage.from('invoices').upload(storagePath, pdfBytes, {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  await anyAdmin.from('invoices').update({ pdf_path: storagePath }).eq('id', invoiceId);

  const { data: signed, error: signedErr } = await anyAdmin.storage
    .from('invoices')
    .createSignedUrl(storagePath, 60 * 60 * 24);
  if (signedErr || !signed?.signedUrl) {
    return NextResponse.json({ error: signedErr?.message ?? 'Unable to create link' }, { status: 500 });
  }

  return NextResponse.json({ pdfUrl: signed.signedUrl, storagePath });
}
