'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { createInvoiceForJob } from '@/server/invoices';

export function CreateInvoiceButton({ jobId, returnTo }: { jobId: string; returnTo?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleCreate = () => {
    startTransition(async () => {
      try {
        const invoice = await createInvoiceForJob(jobId);
        const query = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '';
        router.push(`/invoices/${invoice.id}${query}`);
      } catch {
        // TODO: add toast if needed
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleCreate}
      disabled={isPending}
      className="shrink-0 rounded-[24px] bg-[#111] px-4 py-[10px] text-[13px] font-medium text-white disabled:opacity-50"
    >
      {isPending ? 'Creating…' : 'Create invoice'}
    </button>
  );
}
