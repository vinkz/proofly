import { notFound, redirect } from 'next/navigation';

import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { isUUID } from '@/lib/ids';
import { getInvoice } from '@/server/invoices';
import { InvoiceEditor } from './_components/invoice-editor';

export default async function InvoiceEditorPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  if (!isUUID(invoiceId)) {
    notFound();
  }

  let invoiceData: Awaited<ReturnType<typeof getInvoice>>;
  try {
    invoiceData = await getInvoice(invoiceId);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      redirect('/login');
    }
    notFound();
  }

  const { invoice, lineItems } = invoiceData;
  const sb = await supabaseServerReadOnly();
  const { data: job, error: jobErr } = await sb
    .from('jobs')
    .select('id, client_id, client_name, address, title, certificate_type')
    .eq('id', invoice.job_id)
    .maybeSingle();
  if (jobErr || !job) {
    notFound();
  }

  const certificateType =
    typeof job.certificate_type === 'string' && job.certificate_type.trim()
      ? job.certificate_type
      : (() => null)();

  let resolvedCertificateType = certificateType;
  if (!resolvedCertificateType) {
    const { data: certificate } = await sb
      .from('certificates')
      .select('cert_type, created_at')
      .eq('job_id', invoice.job_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    resolvedCertificateType = typeof certificate?.cert_type === 'string' ? certificate.cert_type : null;
  }

  const { data: client } = job.client_id
    ? await sb
        .from('clients')
        .select('id, name, address, postcode, email, phone')
        .eq('id', job.client_id)
        .maybeSingle()
    : { data: null };

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Invoice</p>
        <h1 className="text-2xl font-semibold text-muted">{invoice.invoice_number}</h1>
        <p className="text-sm text-muted-foreground/70">{job.title ?? 'Job invoice'}</p>
      </div>
      <InvoiceEditor
        invoice={invoice}
        lineItems={lineItems.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity ?? 0),
          unit_price: Number(item.unit_price ?? 0),
          vat_exempt: Boolean(item.vat_exempt),
          position: item.position,
        }))}
        client={
          client
            ? {
                name: client.name ?? job.client_name ?? 'Client',
                address: client.address ?? null,
                postcode: client.postcode ?? null,
                email: client.email ?? null,
                phone: client.phone ?? null,
              }
            : {
                name: job.client_name ?? 'Client',
                address: null,
                postcode: null,
                email: null,
                phone: null,
              }
        }
        job={{
          address: job.address ?? null,
          title: job.title ?? null,
        }}
        certificateType={resolvedCertificateType}
      />
    </main>
  );
}
