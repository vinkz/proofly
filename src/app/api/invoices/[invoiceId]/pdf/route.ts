import { NextResponse } from 'next/server';

import { supabaseServerAction, supabaseServerServiceRole } from '@/lib/supabaseServer';
import { renderInvoicePdf } from '@/server/pdf/renderInvoicePdf';

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

  const { data: invoice, error: invoiceErr } = await sb
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (invoiceErr || !invoice) {
    return NextResponse.json({ error: invoiceErr?.message ?? 'Invoice not found' }, { status: 404 });
  }

  const { data: lineItems, error: itemsErr } = await sb
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

  const { data: profile } = await sb
    .from('profiles')
    .select('company_name, default_engineer_name, default_engineer_id, gas_safe_number')
    .eq('id', user.id)
    .maybeSingle();

  const pdfBytes = await renderInvoicePdf({
    invoice_number: invoice.invoice_number ?? 'Invoice',
    status: invoice.status ?? 'draft',
    issue_date: invoice.issue_date,
    due_date: invoice.due_date,
    vat_rate: Number(invoice.vat_rate ?? 0),
    currency: invoice.currency ?? 'GBP',
    notes: invoice.notes ?? '',
    profile: {
      company_name: profile?.company_name ?? null,
      default_engineer_name: profile?.default_engineer_name ?? null,
      default_engineer_id: profile?.default_engineer_id ?? null,
      gas_safe_number: profile?.gas_safe_number ?? null,
    },
    client: {
      name: invoice.client_name_override ?? client?.name ?? job?.client_name ?? '',
      address: invoice.client_address_override ?? client?.address ?? null,
      email: invoice.client_email_override ?? client?.email ?? null,
      phone: invoice.client_phone_override ?? client?.phone ?? null,
    },
    job: {
      title: job?.title ?? null,
      address: job?.address ?? null,
    },
    lineItems: (lineItems ?? []).map((item) => ({
      description: item.description ?? '',
      quantity: Number(item.quantity ?? 0),
      unit_price: Number(item.unit_price ?? 0),
      vat_exempt: Boolean(item.vat_exempt),
    })),
  });

  const admin = await supabaseServerServiceRole();
  const storagePath = `${user.id}/${invoiceId}.pdf`;
  const { error: uploadErr } = await admin.storage.from('invoices').upload(storagePath, pdfBytes, {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  await admin.from('invoices').update({ pdf_path: storagePath }).eq('id', invoiceId);

  const { data: signed, error: signedErr } = await admin.storage
    .from('invoices')
    .createSignedUrl(storagePath, 60 * 60 * 24);
  if (signedErr || !signed?.signedUrl) {
    return NextResponse.json({ error: signedErr?.message ?? 'Unable to create link' }, { status: 500 });
  }

  return NextResponse.json({ pdfUrl: signed.signedUrl, storagePath });
}
