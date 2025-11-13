'use client';

import { useTransition } from 'react';

import { createReportSignedUrl } from '@/server/jobs';
import { useToast } from '@/components/ui/use-toast';

export function ShareReportLinkButton({ jobId }: { jobId: string }) {
  const [isPending, startTransition] = useTransition();
  const { pushToast } = useToast();

  const handleShare = () => {
    startTransition(async () => {
      try {
        const url = await createReportSignedUrl(jobId);
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(url);
          } else {
            window.prompt('Copy report link', url);
          }
          pushToast({ title: 'Link copied', variant: 'success' });
        } catch (error) {
          console.error('Clipboard error', error);
          pushToast({ title: 'Copy failed', description: 'Unable to copy to clipboard.', variant: 'error' });
        }
      } catch (error) {
        pushToast({
          title: 'Unable to create link',
          description: error instanceof Error ? error.message : 'Try again later.',
          variant: 'error',
        });
      }
    });
  };

  return (
    <button
      type="button"
      className="rounded border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
      onClick={handleShare}
      disabled={isPending}
    >
      {isPending ? 'Creating link…' : 'Share link'}
    </button>
  );
}
