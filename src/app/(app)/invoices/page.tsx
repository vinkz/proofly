import Link from 'next/link';
import { redirect } from 'next/navigation';

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

function computeIsUnpaid(status: string | null | undefined): boolean {
  const s = (status ?? '').toLowerCase();
  return s !== 'paid';
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
    .filter((invoice) => computeIsUnpaid(invoice.status))
    .map(toCardSummary);
  const paidInvoices = invoices
    .filter((invoice) => !computeIsUnpaid(invoice.status))
    .map(toCardSummary);

  const totalOwed = unpaidInvoices.reduce((sum, inv) => sum + inv.total, 0);

  return (
    <div className="min-h-full">
      {/* Page-level header */}
      <div className="border-b-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-[18px] py-[14px]">
          <h1 className="text-[20px] font-medium text-[var(--color-text-primary)]">Invoices</h1>
          <Link
            href="/invoices/new"
            className="flex h-8 w-8 items-center justify-center rounded-full border-[0.5px] border-[var(--color-border-secondary)] text-[var(--color-text-secondary)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span className="sr-only">New invoice</span>
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-[12px] bg-[var(--color-background-secondary)] px-[14px] py-3">
            <p className="text-[22px] font-medium text-[var(--color-text-primary)]">{invoices.length}</p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.4px] text-[var(--color-text-tertiary)]">Total</p>
          </div>
          <div className="rounded-[12px] bg-[var(--color-background-secondary)] px-[14px] py-3">
            <p
              className="text-[22px] font-medium"
              style={{ color: unpaidInvoices.length > 0 ? '#BA7517' : 'var(--color-text-primary)' }}
            >
              {unpaidInvoices.length}
            </p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.4px] text-[var(--color-text-tertiary)]">Unpaid</p>
          </div>
          <div className="rounded-[12px] bg-[var(--color-background-secondary)] px-[14px] py-3">
            <p
              className="text-[22px] font-medium"
              style={{ color: paidInvoices.length > 0 ? '#1a7a52' : 'var(--color-text-primary)' }}
            >
              {paidInvoices.length}
            </p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.4px] text-[var(--color-text-tertiary)]">Paid</p>
          </div>
          <div className="rounded-[12px] bg-[var(--color-background-secondary)] px-[14px] py-3">
            <p
              className="text-[22px] font-medium"
              style={{ color: totalOwed > 0 ? '#BA7517' : 'var(--color-text-primary)' }}
            >
              £{totalOwed.toFixed(0)}
            </p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.4px] text-[var(--color-text-tertiary)]">Owed</p>
          </div>
        </div>

        <InvoiceStatusList unpaidInvoices={unpaidInvoices} paidInvoices={paidInvoices} />

        {invoices.length === 0 ? (
          <div className="rounded-[16px] border-[0.5px] border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-6 text-center">
            <p className="text-[15px] font-medium text-[var(--color-text-primary)]">No invoices yet</p>
            <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
              Create your first invoice from a completed job.
            </p>
            <Link
              href="/invoices/new"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-[24px] bg-[#111] px-5 text-[13px] font-medium text-white"
            >
              Create invoice
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
