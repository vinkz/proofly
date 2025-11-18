'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { deleteJob } from '@/server/jobs';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';

export function DeleteJobButton({ jobId }: { jobId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { pushToast } = useToast();

  const handleDelete = () => {
    const confirmed = window.confirm('Delete this job? This cannot be undone.');
    if (!confirmed) return;
    startTransition(async () => {
      try {
        await deleteJob(jobId);
        pushToast({ title: 'Job deleted', variant: 'success' });
        router.push('/jobs');
        router.refresh();
      } catch (error) {
        pushToast({
          title: 'Unable to delete job',
          description: error instanceof Error ? error.message : 'Try again shortly.',
          variant: 'error',
        });
      }
    });
  };

  return (
    <Button type="button" variant="outline" onClick={handleDelete} disabled={isPending}>
      {isPending ? 'Deleting…' : 'Delete job'}
    </Button>
  );
}
