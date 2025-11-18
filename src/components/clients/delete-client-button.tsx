'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { deleteClient } from '@/server/clients';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';

export function DeleteClientButton({ clientId }: { clientId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { pushToast } = useToast();

  const onDelete = () => {
    if (!window.confirm('Delete this client? This cannot be undone.')) return;
    startTransition(async () => {
      try {
        await deleteClient(clientId);
        pushToast({ title: 'Client deleted', variant: 'success' });
        router.replace('/clients');
        router.refresh();
      } catch (error) {
        pushToast({
          title: 'Unable to delete client',
          description: error instanceof Error ? error.message : 'Try again shortly.',
          variant: 'error',
        });
      }
    });
  };

  return (
    <Button type="button" variant="outline" onClick={onDelete} disabled={isPending}>
      {isPending ? 'Deleting…' : 'Delete'}
    </Button>
  );
}
