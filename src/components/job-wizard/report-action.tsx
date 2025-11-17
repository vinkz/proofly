'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { finalizeJobReport } from '@/server/jobs';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';

export function GenerateWizardReportButton({ jobId }: { jobId: string }) {
  const [isPending, startTransition] = useTransition();
  const { pushToast } = useToast();
  const router = useRouter();

  const handleGenerate = () => {
    startTransition(async () => {
      try {
        await finalizeJobReport(jobId);
        pushToast({ title: 'Report generated', variant: 'success' });
        router.push(`/jobs/new/${jobId}/report`);
        router.refresh();
      } catch (error) {
        pushToast({
          title: 'Unable to generate report',
          description: error instanceof Error ? error.message : 'Try again shortly.',
          variant: 'error',
        });
      }
    });
  };

  return (
    <Button type="button" onClick={handleGenerate} disabled={isPending} className="h-12 rounded-full px-6 text-base">
      {isPending ? 'Generating…' : 'Generate AI report'}
    </Button>
  );
}
