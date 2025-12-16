'use client';

import { useTransition } from 'react';
import type React from 'react';
import { useRouter } from 'next/navigation';

import { deleteJob } from '@/server/jobs';
import { useToast } from '@/components/ui/use-toast';
import { Button, type ButtonProps } from '@/components/ui/button';

type DeleteJobButtonProps = {
  jobId: string;
  variant?: ButtonProps['variant'];
  className?: string;
  stopPropagation?: boolean;
  onDeleted?: () => void;
};

export function DeleteJobButton({ jobId, variant = 'outline', className = '', stopPropagation = false, onDeleted }: DeleteJobButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { pushToast } = useToast();

  const handleDelete = (event?: React.MouseEvent) => {
    if (stopPropagation && event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const confirmed = window.confirm('Delete this job? This cannot be undone.');
    if (!confirmed) return;
    startTransition(async () => {
      try {
        await deleteJob(jobId);
        pushToast({ title: 'Job deleted', variant: 'success' });
        onDeleted?.();
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
    <Button type="button" variant={variant} className={className} onClick={(event) => handleDelete(event)} disabled={isPending}>
      {isPending ? 'Deleting…' : 'Delete job'}
    </Button>
  );
}
