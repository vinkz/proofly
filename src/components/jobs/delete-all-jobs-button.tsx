'use client';

import { useTransition } from 'react';

import { deleteMyJobs } from '@/server/jobs';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';

export function DeleteAllJobsButton() {
  const [isPending, startTransition] = useTransition();
  const { pushToast } = useToast();

  const handleDelete = () => {
    const confirmed = window.confirm('Delete all your jobs and certificates? This cannot be undone.');
    if (!confirmed) return;
    startTransition(async () => {
      try {
        await deleteMyJobs();
        pushToast({ title: 'All jobs deleted', variant: 'success' });
        window.location.href = '/jobs';
      } catch (error) {
        pushToast({
          title: 'Could not delete jobs',
          description: error instanceof Error ? error.message : 'Try again.',
          variant: 'error',
        });
      }
    });
  };

  return (
    <Button type="button" variant="outline" className="rounded-full text-red-600 hover:text-red-700" onClick={handleDelete} disabled={isPending}>
      {isPending ? 'Deleting…' : 'Delete all my jobs'}
    </Button>
  );
}
