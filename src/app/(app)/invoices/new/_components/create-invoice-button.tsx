'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { createInvoiceForJob } from '@/server/invoices';

export function CreateInvoiceButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleCreate = () => {
    startTransition(async () => {
      try {
        const invoice = await createInvoiceForJob(jobId);
        router.push(`/invoices/${invoice.id}`);
      } catch {
        // TODO: add toast if needed
      }
    });
  };

  return (
    <Button onClick={handleCreate} disabled={isPending} className="rounded-full">
      {isPending ? 'Creating…' : 'Create invoice'}
    </Button>
  );
}
