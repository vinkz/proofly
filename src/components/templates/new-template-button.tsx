'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuid } from 'uuid';

import { createTemplate } from '@/server/templates';
import { useToast } from '@/components/ui/use-toast';

export default function NewTemplateButton() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleCreate = () => {
    startTransition(async () => {
      try {
        const payload = {
          name: 'Untitled Template',
          trade_type: 'plumbing',
          items: [
            {
              id: uuid(),
              label: 'New checklist item',
              type: 'toggle',
              required: false,
              photo: false,
            },
          ],
        };
        const { id } = await createTemplate(payload);
        pushToast({ title: 'Template created', variant: 'success' });
        router.push(`/templates/${id}`);
      } catch (error) {
        pushToast({
          title: 'Unable to create template',
          description: error instanceof Error ? error.message : 'Try again later.',
          variant: 'error',
        });
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleCreate}
      disabled={isPending}
      className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
    >
      {isPending ? 'Creating…' : 'New Template'}
    </button>
  );
}
