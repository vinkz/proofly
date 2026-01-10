'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { sendPdfToClient } from '@/server/communications';

type DocumentActionsProps = {
  jobId: string;
  pdfUrl: string | null;
  pdfPath: string | null;
  invoiceId: string | null;
};

export function DocumentActions({ jobId, pdfUrl, pdfPath, invoiceId }: DocumentActionsProps) {
  const [isPending, startTransition] = useTransition();
  const { pushToast } = useToast();
  const router = useRouter();

  const handleShare = () => {
    if (!pdfUrl) {
      pushToast({ title: 'No PDF available', description: 'Generate a PDF first.', variant: 'error' });
      return;
    }
    startTransition(async () => {
      try {
        if (navigator.share) {
          const response = await fetch(pdfUrl);
          if (!response.ok) throw new Error('Unable to download PDF');
          const blob = await response.blob();
          const file = new File([blob], 'document.pdf', { type: 'application/pdf' });
          await navigator.share({
            files: [file],
            title: 'Document PDF',
            text: 'Shared document PDF',
          });
          return;
        }
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(pdfUrl);
          pushToast({ title: 'Link copied', variant: 'success' });
        } else {
          window.prompt('Copy PDF link', pdfUrl);
        }
        window.open(pdfUrl, '_blank', 'noopener,noreferrer');
      } catch (error) {
        pushToast({
          title: 'Unable to share',
          description: error instanceof Error ? error.message : 'Try again.',
          variant: 'error',
        });
      }
    });
  };

  const handleSend = () => {
    startTransition(async () => {
      try {
        const result = await sendPdfToClient({ jobId, pdfPath });
        if (result.status === 'NOT_CONFIGURED') {
          pushToast({
            title: 'Email not configured',
            description: result.message ?? 'Configure an email provider to send PDFs.',
            variant: 'error',
          });
          return;
        }
        pushToast({ title: 'Sent to client', variant: 'success' });
      } catch (error) {
        pushToast({
          title: 'Could not send',
          description: error instanceof Error ? error.message : 'Try again.',
          variant: 'error',
        });
      }
    });
  };

  const handleCreateInvoice = () => {
    router.push(`/invoices/new?jobId=${jobId}`);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button className="rounded-full bg-[var(--accent)] px-4 py-2 text-white" onClick={handleShare} disabled={isPending}>
        Share
      </Button>
      <Button className="rounded-full bg-[var(--action)] px-4 py-2 text-white" onClick={handleSend} disabled={isPending}>
        Send to Client
      </Button>
      <Button asChild variant="outline" className="rounded-full" disabled={!pdfUrl || isPending}>
        <a href={pdfUrl ?? undefined} download target="_blank" rel="noreferrer">
          Download PDF
        </a>
      </Button>
      {invoiceId ? (
        <Button asChild variant="secondary" className="rounded-full">
          <a href={`/invoices/${invoiceId}`}>View Invoice</a>
        </Button>
      ) : (
        <Button variant="secondary" className="rounded-full" onClick={handleCreateInvoice} disabled={isPending}>
          Create Invoice
        </Button>
      )}
    </div>
  );
}
