'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { finalizeJobReport } from '@/server/jobs';
import type { ReportKind } from '@/types/reports';
import { ANALYTICS_EVENTS, track } from '@/lib/analytics/events';
import { useToast } from '@/components/ui/use-toast';
import { toUserMessage } from '@/lib/user-errors';

export function GenerateReportButton({ jobId, reportKind }: { jobId: string; reportKind: ReportKind }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { pushToast } = useToast();

  const handleGenerate = () => {
    startTransition(async () => {
      try {
        const { signedUrl } = await finalizeJobReport(jobId, reportKind);
        track(ANALYTICS_EVENTS.reportGenerated, { report_kind: reportKind });
        pushToast({ title: 'Report generated', variant: 'success' });
        router.refresh();
        router.push(`/jobs/${jobId}/pdf`);
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
          description: toUserMessage(error, 'Try again in a moment.'),
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
