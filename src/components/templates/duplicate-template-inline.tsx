'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { duplicateTemplate } from '@/server/templates';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

export function DuplicateTemplateInline({ templateId }: { templateId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { pushToast } = useToast();

  const handleDuplicate = () => {
    startTransition(async () => {
      try {
        const { id } = await duplicateTemplate(templateId);
        pushToast({ title: 'Template duplicated', variant: 'success' });
        router.push(`/templates/${id}`);
      } catch (error) {
        pushToast({
          title: 'Unable to duplicate template',
          description: error instanceof Error ? error.message : 'Try again later.',
          variant: 'error',
        });
      }
    });
  };

  return (
    <Button type="button" variant="outline" onClick={handleDuplicate} disabled={isPending}>
      {isPending ? 'Duplicating…' : 'Duplicate'}
    </Button>
  );
}
