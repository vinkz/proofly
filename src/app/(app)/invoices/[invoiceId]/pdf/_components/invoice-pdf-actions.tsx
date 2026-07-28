'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { ANALYTICS_EVENTS, track } from '@/lib/analytics/events';
import { useToast } from '@/components/ui/use-toast';
import { toUserMessage } from '@/lib/user-errors';

export function InvoicePdfActions({ invoiceId }: { invoiceId: string }) {
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const startedRef = useRef(false);

  const handleGenerate = (redirect: boolean) => {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/invoices/${invoiceId}/pdf`, { method: 'POST' });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? 'Unable to generate PDF');
        }
        const payload = (await response.json()) as { pdfUrl?: string };
        setPdfUrl(payload.pdfUrl ?? null);
        track(ANALYTICS_EVENTS.invoicePdfGenerated);
        if (payload.pdfUrl) {
          // Reached via "Review": show the PDF in place rather than a manual step.
          if (redirect) window.location.href = payload.pdfUrl;
          else window.open(payload.pdfUrl, '_blank');
        }
      } catch (error) {
        pushToast({
          title: 'Unable to generate PDF',
          description: toUserMessage(error, 'Please try again.'),
          variant: 'error',
        });
      }
    });
  };

  // Auto-generate and show the PDF when the page is opened for a draft (no stored
  // pdf_path). Guarded so it runs once (React StrictMode double-invokes effects).
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    handleGenerate(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <Button className="rounded-full" onClick={() => handleGenerate(false)} disabled={isPending}>
      {isPending ? 'Preparing PDF…' : 'Generate PDF'}
    </Button>
  );
}
