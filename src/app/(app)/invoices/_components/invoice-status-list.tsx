'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { setInvoiceMeta } from '@/server/invoices';

export type InvoiceCardSummary = {
  id: string;
  invoice_number: string;
  status: string | null;
  issue_date: string | null;
  due_date: string | null;
  created_at: string;
  total: number;
  job_title: string | null;
  job_client_name: string | null;
  job_address: string | null;
};

function normalizeInvoiceStatus(status: string | null | undefined) {
  return status === 'paid' ? 'paid' : 'unpaid';
}

function formatMoney(value: number) {
  return `£${value.toFixed(2)}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function InvoiceSection({
  title,
  invoices,
}: {
  title: string;
  invoices: InvoiceCardSummary[];
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleStatusChange = (invoiceId: string, nextStatus: 'paid' | 'unpaid') => {
    startTransition(async () => {
      try {
        await setInvoiceMeta(invoiceId, {
          status: nextStatus === 'paid' ? 'paid' : 'draft',
        });
        pushToast({ title: `Invoice marked ${nextStatus}`, variant: 'success' });
        router.refresh();
      } catch (error) {
        pushToast({
          title: 'Unable to update invoice',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-muted">{title}</h2>
        <Badge variant="brand">{invoices.length}</Badge>
      </div>
      {invoices.length ? (
        <div className="space-y-3">
          {invoices.map((invoice) => {
            const status = normalizeInvoiceStatus(invoice.status);
            return (
              <div key={invoice.id} className="rounded-2xl border border-white/10 bg-white/80 p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-semibold text-muted">{invoice.invoice_number}</p>
                      <Badge variant="brand" className="uppercase">
                        {status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted">{invoice.job_title ?? invoice.job_client_name ?? 'Invoice'}</p>
                    <p className="text-sm text-muted-foreground/70">{invoice.job_address ?? 'Address not set'}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground/70">
                      {formatDate(invoice.issue_date) ? <span>Issue: {formatDate(invoice.issue_date)}</span> : null}
                      {formatDate(invoice.due_date) ? <span>Due: {formatDate(invoice.due_date)}</span> : null}
                      <span>Created: {formatDate(invoice.created_at) ?? 'Unknown'}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-start gap-3 sm:items-end">
                    <p className="text-base font-semibold text-muted">{formatMoney(invoice.total)}</p>
                    <div className="flex gap-2">
                      <Button
                        variant={status === 'unpaid' ? 'primary' : 'outline'}
                        className="rounded-full"
                        disabled={isPending}
                        onClick={() => handleStatusChange(invoice.id, 'unpaid')}
                      >
                        Unpaid
                      </Button>
                      <Button
                        variant={status === 'paid' ? 'primary' : 'outline'}
                        className="rounded-full"
                        disabled={isPending}
                        onClick={() => handleStatusChange(invoice.id, 'paid')}
                      >
                        Paid
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button asChild variant="secondary" className="rounded-full">
                        <Link href={`/invoices/${invoice.id}/pdf`}>Open PDF</Link>
                      </Button>
                      <Button asChild variant="outline" className="rounded-full">
                        <Link href={`/invoices/${invoice.id}`}>Edit</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/20 bg-white/40 p-6 text-sm text-muted-foreground/70">
          No {title.toLowerCase()}.
        </div>
      )}
    </section>
  );
}

export function InvoiceStatusList({
  unpaidInvoices,
  paidInvoices,
}: {
  unpaidInvoices: InvoiceCardSummary[];
  paidInvoices: InvoiceCardSummary[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <InvoiceSection title="Unpaid" invoices={unpaidInvoices} />
      <InvoiceSection title="Paid" invoices={paidInvoices} />
    </div>
  );
}
