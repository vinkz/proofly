'use client';

import { useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { sendPdfToClient } from '@/server/certificates';
import { useToast } from '@/components/ui/use-toast';
import type { CertificateType } from '@/types/certificates';

export function PdfActions({
  jobId,
  sentAt,
  certificateType,
}: {
  jobId: string;
  sentAt: string | null;
  certificateType?: CertificateType | null;
}) {
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleSend = () => {
    if (sentAt === null && !jobId) return;
    startTransition(async () => {
      try {
        await sendPdfToClient({ jobId });
        pushToast({ title: 'PDF sent', variant: 'success' });
      } catch (error) {
        pushToast({
          title: 'Could not send',
          description: error instanceof Error ? error.message : 'Try again.',
          variant: 'error',
        });
      }
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button className="rounded-full bg-[var(--accent)] px-4 py-2 text-white" onClick={handleSend} disabled={isPending}>
        {isPending ? 'Sending…' : 'Send to Client'}
      </Button>
      {certificateType ? (
        <Button asChild variant="outline" className="rounded-full">
          <a href={`/wizard/create/${certificateType}?jobId=${jobId}`} className="px-4 py-2">
            Edit Before Sending
          </a>
        </Button>
      ) : null}
      <Button variant="secondary" className="rounded-full">
        Download PDF
      </Button>
      {sentAt ? (
        <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
          ✅ PDF sent at {new Date(sentAt).toLocaleString()}
        </span>
      ) : null}
    </div>
  );
}
