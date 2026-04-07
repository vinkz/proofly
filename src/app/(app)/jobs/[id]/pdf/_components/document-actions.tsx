'use client';

import { useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

type DocumentActionsProps = {
  pdfUrl: string | null;
};

export function DocumentActions({ pdfUrl }: DocumentActionsProps) {
  const [isPending, startTransition] = useTransition();
  const { pushToast } = useToast();

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

  return (
    <div className="flex flex-wrap gap-2">
      <Button className="rounded-full bg-[var(--accent)] px-4 py-2 text-white" onClick={handleShare} disabled={isPending}>
        Share
      </Button>
    </div>
  );
}
