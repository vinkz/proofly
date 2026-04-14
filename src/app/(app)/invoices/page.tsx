import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { listInvoices, type InvoiceRow } from '@/server/invoices';
import { InvoiceStatusList, type InvoiceCardSummary } from './_components/invoice-status-list';

type JobSummary = {
  id: string;
  client_name: string | null;
  address: string | null;
  title: string | null;
};

type InvoiceLineItem = {
  invoice_id: string | null;
  quantity: number | string | null;
  unit_price: number | string | null;
  vat_exempt: boolean | null;
};

function normalizeInvoiceStatus(status: string | null | undefined) {
  return status === 'paid' ? 'paid' : 'unpaid';
}

export default async function InvoicesPage() {
  const supabase = await supabaseServerReadOnly();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const invoices = await listInvoices();
  const jobIds = invoices.map((invoice) => invoice.job_id);
  const invoiceIds = invoices.map((invoice) => invoice.id);

  const [jobsResponse, itemsResponse] = await Promise.all([
    jobIds.length
      ? ((supabase
          .from('jobs')
          .select('id, client_name, address, title')
          .in('id', jobIds)) as unknown as Promise<{ data: JobSummary[] | null; error: { message: string } | null }>)
      : Promise.resolve({ data: [] as JobSummary[], error: null }),
    invoiceIds.length
      ? ((supabase as unknown as { from: (table: string) => { select: (columns: string) => { in: (column: string, values: string[]) => Promise<{ data: InvoiceLineItem[] | null; error: { message: string } | null }> } } })
          .from('invoice_line_items')
          .select('invoice_id, quantity, unit_price, vat_exempt')
          .in('invoice_id', invoiceIds))
      : Promise.resolve({ data: [] as InvoiceLineItem[], error: null }),
  ]);

  if (jobsResponse.error) throw new Error(jobsResponse.error.message);
  if (itemsResponse.error) throw new Error(itemsResponse.error.message);

  const jobsById = new Map<string, JobSummary>((jobsResponse.data ?? []).map((job) => [job.id, job]));
  const groupedItems = (itemsResponse.data ?? []).reduce<Record<string, Array<{ quantity: number; unit_price: number; vat_exempt: boolean }>>>(
    (acc, item) => {
      const invoiceId = item.invoice_id ?? '';
      if (!invoiceId) return acc;
      const quantity = Number(item.quantity ?? 0);
      const unitPrice = Number(item.unit_price ?? 0);
      const vatExempt = Boolean(item.vat_exempt);
      acc[invoiceId] = acc[invoiceId]
        ? [...acc[invoiceId], { quantity, unit_price: unitPrice, vat_exempt: vatExempt }]
        : [{ quantity, unit_price: unitPrice, vat_exempt: vatExempt }];
      return acc;
    },
    {},
  );

  const totalsByInvoiceId = new Map<string, number>();
  invoices.forEach((invoice) => {
    const vatRate = Number(invoice.vat_rate ?? 0);
    const rows = groupedItems[invoice.id] ?? [];
    const subtotal = rows.reduce((sum, row) => sum + row.quantity * row.unit_price, 0);
    const taxable = rows.reduce((sum, row) => sum + (row.vat_exempt ? 0 : row.quantity * row.unit_price), 0);
    totalsByInvoiceId.set(invoice.id, subtotal + taxable * vatRate);
  });

  const toCardSummary = (invoice: InvoiceRow): InvoiceCardSummary => {
    const job = jobsById.get(invoice.job_id);
    return {
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      status: invoice.status,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date,
      created_at: invoice.created_at,
      total: totalsByInvoiceId.get(invoice.id) ?? 0,
      job_title: job?.title ?? null,
      job_client_name: job?.client_name ?? null,
      job_address: job?.address ?? null,
    };
  };

  const unpaidInvoices = invoices
    .filter((invoice) => normalizeInvoiceStatus(invoice.status) === 'unpaid')
    .map(toCardSummary);
  const paidInvoices = invoices
    .filter((invoice) => normalizeInvoiceStatus(invoice.status) === 'paid')
    .map(toCardSummary);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/dashboard" className="text-xs uppercase tracking-wide text-accent">
            ← Back to dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-muted">Invoices</h1>
          <p className="text-sm text-muted-foreground/70">Track unpaid and paid invoices in one place.</p>
        </div>
        <Button asChild className="rounded-full">
          <Link href="/invoices/new">Create invoice</Link>
        </Button>
      </div>

      <InvoiceStatusList unpaidInvoices={unpaidInvoices} paidInvoices={paidInvoices} />
    </main>
  );
}
