'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';

import { saveJobDetails } from '@/server/jobs';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface JobDetailsFormProps {
  jobId: string;
  defaultValues: {
    title: string;
    scheduled_for: string;
    technician_name: string;
    notes: string;
  };
}

type FormValues = JobDetailsFormProps['defaultValues'];

export function JobDetailsForm({ jobId, defaultValues }: JobDetailsFormProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const { register, handleSubmit } = useForm<FormValues>({ defaultValues });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      try {
        await saveJobDetails(jobId, values);
        pushToast({ title: 'Job details saved', variant: 'success' });
        router.push(`/jobs/new/${jobId}/inspection`);
      } catch (error) {
        pushToast({
          title: 'Unable to save',
          description: error instanceof Error ? error.message : 'Try again shortly.',
          variant: 'error',
        });
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
          Job title
        </label>
        <Input {...register('title')} placeholder="e.g. Boiler compliance audit" className="mt-1" required disabled={isPending} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
            Date & time
          </label>
          <Input type="datetime-local" {...register('scheduled_for')} className="mt-1" required disabled={isPending} />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
            Assigned technician
          </label>
          <Input {...register('technician_name')} placeholder="Alex Morgan" className="mt-1" required disabled={isPending} />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
          Notes
        </label>
        <Textarea {...register('notes')} rows={4} placeholder="Site notes, access instructions, materials…" className="mt-1" disabled={isPending} />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save & continue'}
        </Button>
      </div>
    </form>
  );
}
