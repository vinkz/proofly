'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { useToast } from '@/components/ui/use-toast';
import { createBlankInvoice } from '@/server/invoices';

type ClientOption = {
  id: string;
  name: string;
};

export function CreateBlankInvoiceButton({ clients }: { clients: ClientOption[] }) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [clientId, setClientId] = useState('');

  const handleCreate = () => {
    startTransition(async () => {
      try {
        const invoice = await createBlankInvoice({ clientId: clientId || null });
        router.push(`/invoices/${invoice.id}`);
      } catch (error) {
        pushToast({
          title: 'Unable to create invoice',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <label
          htmlFor="blank-invoice-client"
          className="text-[11px] font-medium uppercase tracking-[0.4px] text-[var(--color-text-tertiary)]"
        >
          Link a client (optional)
        </label>
        <select
          id="blank-invoice-client"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="mt-1 w-full rounded-[10px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3 py-2 text-[14px] text-[var(--color-text-primary)] outline-none"
        >
          <option value="">No client — enter details on the invoice</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={handleCreate}
        disabled={isPending}
        className="h-10 shrink-0 rounded-[24px] bg-[#111] px-5 text-[13px] font-medium text-white disabled:opacity-50"
      >
        {isPending ? 'Creating…' : 'Blank invoice'}
      </button>
    </div>
  );
}
