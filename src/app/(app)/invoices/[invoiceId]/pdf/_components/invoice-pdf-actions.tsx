'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

export function InvoicePdfActions({ invoiceId }: { invoiceId: string }) {
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const handleGenerate = () => {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/invoices/${invoiceId}/pdf`, { method: 'POST' });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? 'Unable to generate PDF');
        }
        const payload = (await response.json()) as { pdfUrl?: string };
        setPdfUrl(payload.pdfUrl ?? null);
        pushToast({ title: 'PDF generated', variant: 'success' });
        if (payload.pdfUrl) {
          window.open(payload.pdfUrl, '_blank');
        }
      } catch (error) {
        pushToast({
          title: 'Unable to generate PDF',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  if (pdfUrl) {
    return (
      <Button asChild className="rounded-full">
        <a href={pdfUrl} target="_blank" rel="noreferrer">
          Open PDF
        </a>
      </Button>
    );
  }

  return (
    <Button className="rounded-full" onClick={handleGenerate} disabled={isPending}>
      {isPending ? 'Generating…' : 'Generate PDF'}
    </Button>
  );
}
