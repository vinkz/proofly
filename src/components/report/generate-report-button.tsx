'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { finalizeJobReport } from '@/server/jobs';
import { useToast } from '@/components/ui/use-toast';

export function GenerateReportButton({ jobId }: { jobId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { pushToast } = useToast();

  const handleGenerate = () => {
    startTransition(async () => {
      try {
        const { signedUrl } = await finalizeJobReport(jobId);
        pushToast({ title: 'Report generated', variant: 'success' });
        router.refresh();
        router.push(`/reports/${jobId}`);
        if (signedUrl && typeof window !== 'undefined') {
          try {
            window.open(signedUrl, '_blank');
          } catch {
            // ignore window blocking
          }
        }
      } catch (error) {
        pushToast({
          title: 'Unable to generate report',
          description: error instanceof Error ? error.message : 'Try again in a moment.',
          variant: 'error',
        });
      }
    });
  };

  return (
    <button
      type="button"
      className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      onClick={handleGenerate}
      disabled={isPending}
    >
      {isPending ? 'Generating…' : 'Generate report'}
    </button>
  );
}
