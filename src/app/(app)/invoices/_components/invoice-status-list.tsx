'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

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

type DisplayStatus = 'draft' | 'unpaid' | 'overdue' | 'paid';

const STATUS_BADGE: Record<DisplayStatus, { bg: string; color: string; label: string }> = {
  draft:   { bg: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)', label: 'Draft' },
  unpaid:  { bg: '#faeeda', color: '#BA7517',         label: 'Unpaid' },
  overdue: { bg: '#fcebeb', color: '#a32d2d',         label: 'Overdue' },
  paid:    { bg: '#edf7f2', color: '#1a7a52',         label: 'Paid' },
};

function computeDisplayStatus(
  status: string | null | undefined,
  dueDate: string | null | undefined,
): DisplayStatus {
  const s = (status ?? '').toLowerCase();
  if (s === 'paid') return 'paid';
  if (s === 'overdue') return 'overdue';
  if (
    dueDate &&
    !Number.isNaN(new Date(dueDate).getTime()) &&
    new Date(dueDate) < new Date()
  ) return 'overdue';
  if (s === 'unpaid') return 'unpaid';
  return 'draft';
}

function formatMoney(value: number) {
  return `£${value.toFixed(2)}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
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

  const handleStatusChange = (invoiceId: string, nextStatus: 'paid' | 'draft') => {
    startTransition(async () => {
      try {
        await setInvoiceMeta(invoiceId, { status: nextStatus });
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
    <div>
      <p className="mb-1.5 px-0.5 text-[13px] font-medium tracking-[0.3px] text-[var(--color-text-tertiary)]">
        {title}
      </p>
      <div className="overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
        {invoices.length > 0 ? (
          invoices.map((invoice, index) => {
            const ds = computeDisplayStatus(invoice.status, invoice.due_date);
            const badge = STATUS_BADGE[ds];
            return (
              <div
                key={invoice.id}
                className={`${index > 0 ? 'border-t-[0.5px] border-[var(--color-border-tertiary)]' : ''}`}
              >
                <div className="flex items-start justify-between gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[14px] font-medium text-[var(--color-text-primary)]">
                        {invoice.invoice_number}
                      </p>
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{ backgroundColor: badge.bg, color: badge.color }}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[13px] text-[var(--color-text-secondary)]">
                      {invoice.job_title ?? invoice.job_client_name ?? 'Invoice'}
                    </p>
                    {invoice.job_address ? (
                      <p className="mt-0.5 truncate text-[12px] text-[var(--color-text-tertiary)]">
                        {invoice.job_address}
                      </p>
                    ) : null}
                    <div className="mt-1 flex flex-wrap gap-2 text-[12px] text-[var(--color-text-tertiary)]">
                      {formatDate(invoice.issue_date) ? (
                        <span>Issued {formatDate(invoice.issue_date)}</span>
                      ) : null}
                      {formatDate(invoice.due_date) ? (
                        <span style={{ color: ds === 'overdue' ? '#a32d2d' : undefined }}>
                          Due {formatDate(invoice.due_date)}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <p className="text-[15px] font-medium text-[var(--color-text-primary)]">
                      {formatMoney(invoice.total)}
                    </p>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleStatusChange(invoice.id, ds === 'paid' ? 'draft' : 'paid')}
                        className="h-7 rounded-full border-[0.5px] border-[var(--color-border-secondary)] px-3 text-[12px] font-medium text-[var(--color-text-secondary)] disabled:opacity-50"
                      >
                        {ds === 'paid' ? 'Mark unpaid' : 'Mark paid'}
                      </button>
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="inline-flex h-7 items-center justify-center rounded-full border-[0.5px] border-[var(--color-border-secondary)] px-3 text-[12px] font-medium text-[var(--color-text-secondary)]"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <p className="p-4 text-[13px] text-[var(--color-text-secondary)]">No {title.toLowerCase()}.</p>
        )}
      </div>
    </div>
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
    <div className="space-y-4">
      <InvoiceSection title="Needs attention" invoices={unpaidInvoices} />
      <InvoiceSection title="Paid" invoices={paidInvoices} />
    </div>
  );
}
