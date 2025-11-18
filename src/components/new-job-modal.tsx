'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import type { TemplateModel } from '@/types/template';
import { createJob } from '@/server/jobs';

const jobSchema = z.object({
  client_name: z.string().trim().min(2, 'Client name is required'),
  address: z.string().trim().min(2, 'Address is required'),
  template_id: z.string().uuid('Select a template'),
});

type FormValues = z.infer<typeof jobSchema>;

export default function NewJobModal({ templates }: { templates: TemplateModel[] }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { pushToast } = useToast();

  const defaultTemplateId = useMemo(() => templates[0]?.id ?? '', [templates]);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      client_name: '',
      address: '',
      template_id: defaultTemplateId,
    },
  });

  useEffect(() => {
    reset({ client_name: '', address: '', template_id: defaultTemplateId });
  }, [defaultTemplateId, reset, open]);

  const close = () => setOpen(false);

  const onSubmit = handleSubmit((values) => {
    const parsed = jobSchema.safeParse(values);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (typeof field === 'string') {
          setError(field as keyof FormValues, { message: issue.message });
        }
      });
      return;
    }

    startTransition(async () => {
      try {
        const { jobId } = await createJob(parsed.data);
        pushToast({ title: 'Job created', variant: 'success' });
        close();
        reset({ client_name: '', address: '', template_id: defaultTemplateId });
        router.push(`/jobs/${jobId}`);
      } catch (error) {
        console.error(error);
        pushToast({
          title: 'Could not create job',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  });

  return (
    <>
      <Button
        className="fixed bottom-6 right-6 z-30 h-14 w-14 rounded-full p-0 text-3xl"
        onClick={() => setOpen(true)}
        aria-label="New job"
      >
        +
      </Button>
      <Modal open={open} onClose={close} title="New Job">
        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor="client_name" className="block text-sm font-medium text-gray-700">
              Client name
            </label>
            <Input
              id="client_name"
              placeholder="Jane Doe"
              disabled={isPending}
              {...register('client_name')}
            />
            {errors.client_name ? (
              <p className="mt-1 text-xs text-red-600">{errors.client_name.message}</p>
            ) : null}
          </div>
          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700">
              Site address
            </label>
            <Input
              id="address"
              placeholder="123 Pipe St, Springfield"
              disabled={isPending}
              {...register('address')}
            />
            {errors.address ? <p className="mt-1 text-xs text-red-600">{errors.address.message}</p> : null}
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="template_id" className="block text-sm font-medium text-gray-700">
                Workflow
              </label>
              <Link href="/templates" className="text-xs text-emerald-600 underline">
                Manage workflows
              </Link>
            </div>
            {templates.length === 0 ? (
              <p className="mt-1 text-sm text-gray-500">
                No workflows available yet. Contact an admin or create a workflow to get started.
              </p>
            ) : (
              <Select id="template_id" disabled={isPending} {...register('template_id')}>
                <option value="">Select a workflow</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </Select>
            )}
            {errors.template_id ? (
              <p className="mt-1 text-xs text-red-600">{errors.template_id.message}</p>
            ) : null}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={close}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || templates.length === 0}>
              {isPending ? 'Creating…' : 'Create job'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
