'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { createInvoiceForJob } from '@/server/invoices';

type InvoiceSummary = {
  id: string;
  invoice_number: string;
  status: string;
  total: number;
};

export function JobInvoicesCard({
  jobId,
  invoices,
}: {
  jobId: string;
  invoices: InvoiceSummary[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleCreate = () => {
    startTransition(async () => {
      try {
        const invoice = await createInvoiceForJob(jobId);
        router.push(`/invoices/${invoice.id}`);
      } catch {
        // TODO: wire toast if needed
      }
    });
  };

  return (
    <section className="mt-8 space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-muted">Invoices</h2>
        <p className="text-sm text-muted-foreground/70">Create and manage invoices for this job.</p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        {invoices.length === 0 ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground/80">No invoices yet.</p>
            <Button onClick={handleCreate} disabled={isPending} className="rounded-full">
              {isPending ? 'Creating…' : 'Create invoice'}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/70 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-muted">{invoice.invoice_number}</p>
                  <p className="text-xs uppercase text-muted-foreground/70">{invoice.status}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm text-muted-foreground/80">
                    £{invoice.total.toFixed(2)}
                  </p>
                  <Button asChild variant="outline" className="rounded-full">
                    <a href={`/invoices/${invoice.id}`}>Open</a>
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex justify-end">
              <Button onClick={handleCreate} disabled={isPending} className="rounded-full">
                {isPending ? 'Creating…' : 'Create another invoice'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
