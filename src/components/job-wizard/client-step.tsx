'use client';

import { useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';

import type { ClientListItem } from '@/types/client';
import { createClient } from '@/server/clients';
import { createJobDraftFromClient } from '@/server/jobs';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ClientPickerProps {
  clients: ClientListItem[];
}

export function ClientPicker({ clients }: ClientPickerProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleSelect = (clientId: string) => {
    startTransition(async () => {
      try {
        const { jobId } = await createJobDraftFromClient(clientId);
        pushToast({ title: 'Client selected', variant: 'success' });
        router.push(`/jobs/new/${jobId}/template`);
      } catch (error) {
        pushToast({
          title: 'Unable to start job',
          description: error instanceof Error ? error.message : 'Try again shortly.',
          variant: 'error',
        });
      }
    });
  };

  return (
    <div className="space-y-3">
      {clients.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/30 p-4 text-sm text-muted-foreground/70">
          No clients match your search.
        </p>
      ) : (
        clients.map((client) => (
          <div
            key={client.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/30 bg-white/80 p-4"
          >
            <div>
              <p className="text-base font-semibold text-muted">{client.name}</p>
              <p className="text-sm text-muted-foreground/70">
                {[client.organization, client.email, client.phone].filter(Boolean).join(' · ')}
              </p>
              {client.address ? (
                <p className="text-xs text-muted-foreground/60">{client.address}</p>
              ) : null}
            </div>
            <Button type="button" onClick={() => handleSelect(client.id)} disabled={isPending}>
              Select
            </Button>
          </div>
        ))
      )}
    </div>
  );
}

type ClientFormValues = {
  name: string;
  organization: string;
  email: string;
  phone: string;
  address: string;
};

export function NewClientForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const { register, handleSubmit, reset } = useForm<ClientFormValues>({
    defaultValues: { name: '', organization: '', email: '', phone: '', address: '' },
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      try {
        const { id } = await createClient(values);
        const { jobId } = await createJobDraftFromClient(id);
        pushToast({ title: 'Client created', variant: 'success' });
        reset();
        const nextUrl = searchParams?.get('redirect') ?? `/jobs/new/${jobId}/template`;
        router.push(nextUrl);
      } catch (error) {
        pushToast({
          title: 'Unable to create client',
          description: error instanceof Error ? error.message : 'Check details and try again.',
          variant: 'error',
        });
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
          Name
        </label>
        <Input {...register('name')} placeholder="Client name" required className="mt-1" disabled={isPending} />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
          Company
        </label>
        <Input {...register('organization')} placeholder="Company (optional)" className="mt-1" disabled={isPending} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
            Email
          </label>
          <Input type="email" {...register('email')} placeholder="client@example.com" className="mt-1" disabled={isPending} />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
            Phone
          </label>
          <Input {...register('phone')} placeholder="+1 555 0100" className="mt-1" disabled={isPending} />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
          Address
        </label>
        <Input {...register('address')} placeholder="123 River St, Springfield" className="mt-1" disabled={isPending} />
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Creating…' : 'Create and continue'}
      </Button>
    </form>
  );
}
