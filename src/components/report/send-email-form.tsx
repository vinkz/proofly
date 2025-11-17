'use client';

import { useTransition } from 'react';
import { useForm } from 'react-hook-form';

import { sendReportEmail } from '@/server/jobs';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ReportEmailFormProps {
  jobId: string;
}

type FormValues = {
  email: string;
  name: string;
};

export function ReportEmailForm({ jobId }: ReportEmailFormProps) {
  const { register, handleSubmit, reset } = useForm<FormValues>({ defaultValues: { email: '', name: '' } });
  const [isPending, startTransition] = useTransition();
  const { pushToast } = useToast();

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      try {
        await sendReportEmail(jobId, values);
        pushToast({ title: 'Email queued', variant: 'success' });
        reset();
      } catch (error) {
        pushToast({
          title: 'Unable to send',
          description: error instanceof Error ? error.message : 'Try again shortly.',
          variant: 'error',
        });
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Recipient</label>
        <Input
          {...register('name')}
          placeholder="Client name"
          className="mt-1"
          disabled={isPending}
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Email</label>
        <Input
          type="email"
          {...register('email')}
          placeholder="client@example.com"
          required
          className="mt-1"
          disabled={isPending}
        />
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Sending…' : 'Send email'}
      </Button>
    </form>
  );
}
