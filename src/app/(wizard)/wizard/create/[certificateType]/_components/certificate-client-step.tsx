'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';

import type { CertificateType } from '@/types/certificates';
import type { ClientListItem } from '@/types/client';
import { createClient } from '@/server/clients';
import { assignClientToJob, createJob } from '@/server/certificates';
import { WizardLayout } from '@/components/certificates/wizard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

type ClientFormValues = {
  name: string;
  organization: string;
  email: string;
  phone: string;
  address: string;
};

type CertificateClientStepProps = {
  certificateType: CertificateType;
  clients: ClientListItem[];
  totalSteps: number;
  jobId?: string | null;
};

export function CertificateClientStep({
  certificateType,
  clients,
  totalSteps,
  jobId: initialJobId = null,
}: CertificateClientStepProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [clientOptions, setClientOptions] = useState(clients);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [jobId, setJobId] = useState<string | null>(initialJobId);
  const { register, handleSubmit, reset } = useForm<ClientFormValues>({
    defaultValues: { name: '', organization: '', email: '', phone: '', address: '' },
  });

  const isCp12 = certificateType === 'cp12';
  const addClientValue = '__add_client__';

  const redirectToWizard = (jobId: string) => {
    router.push(`/wizard/create/${certificateType}?jobId=${jobId}&clientStep=1`);
  };

  const handleSelect = (clientId: string) => {
    startTransition(async () => {
      try {
        setShowNewClientForm(false);
        let targetJobId = jobId;
        if (isCp12) {
          if (targetJobId) {
            await assignClientToJob({ jobId: targetJobId, clientId });
          } else {
            const { jobId: createdJobId } = await createJob({ certificateType, clientId });
            targetJobId = createdJobId;
            setJobId(createdJobId);
          }
          pushToast({ title: 'Client selected', variant: 'success' });
          router.push(`/wizard/create/${certificateType}?jobId=${targetJobId}`);
          return;
        }
        const { jobId: createdJobId } = await createJob({ certificateType, clientId });
        pushToast({ title: 'Client selected', variant: 'success' });
        redirectToWizard(createdJobId);
      } catch (error) {
        pushToast({
          title: 'Unable to start job',
          description: error instanceof Error ? error.message : 'Try again shortly.',
          variant: 'error',
        });
      }
    });
  };


  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      try {
        const { id } = await createClient(values);
        const newClient: ClientListItem = {
          id,
          name: values.name,
          organization: values.organization || null,
          email: values.email || null,
          phone: values.phone || null,
          address: values.address || null,
          postcode: null,
          landlord_name: null,
          landlord_address: null,
          user_id: null,
          created_at: null,
          updated_at: null,
        };
        setClientOptions((prev) => [newClient, ...prev]);
        setSelectedClientId(id);
        if (isCp12) {
          let targetJobId = jobId;
          if (targetJobId) {
            await assignClientToJob({ jobId: targetJobId, clientId: id });
          } else {
            const { jobId: createdJobId } = await createJob({ certificateType, clientId: id });
            targetJobId = createdJobId;
            setJobId(createdJobId);
          }
          pushToast({ title: 'Client created', variant: 'success' });
          reset();
          setShowNewClientForm(false);
          router.push(`/wizard/create/${certificateType}?jobId=${targetJobId}`);
          return;
        }
        const { jobId: createdJobId } = await createJob({ certificateType, clientId: id });
        pushToast({ title: 'Client created', variant: 'success' });
        reset();
        redirectToWizard(createdJobId);
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
    <WizardLayout step={1} total={totalSteps} title="Select or create client" status="Client">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--accent)]">Step 1</p>
          <p className="text-sm text-muted-foreground/70">
            Pick a client to prefill contact details.
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        <div className="rounded-2xl border border-white/20 bg-white/70 p-4 shadow-inner">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Select
                value={selectedClientId}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === addClientValue) {
                    setSelectedClientId('');
                    setShowNewClientForm(true);
                    return;
                  }
                  setSelectedClientId(value);
                  if (value) handleSelect(value);
                }}
                className="flex-1"
                disabled={isPending}
              >
                <option value="">Select or create client</option>
                {clientOptions.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                    {client.email ? ` (${client.email})` : ''}
                  </option>
                ))}
                <option value={addClientValue}>Add client</option>
              </Select>
            </div>
            {clientOptions.length === 0 ? (
              <p className="text-xs text-muted-foreground/60">
                No clients yet. Choose Add client to enter details.
              </p>
            ) : null}
          </div>

          {showNewClientForm ? (
            <form onSubmit={onSubmit} className="mt-4 space-y-3">
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
                <Input
                  {...register('organization')}
                  placeholder="Company (optional)"
                  className="mt-1"
                  disabled={isPending}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
                    Email
                  </label>
                  <Input
                    type="email"
                    {...register('email')}
                    placeholder="client@example.com"
                    className="mt-1"
                    disabled={isPending}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
                    Phone
                  </label>
                  <Input {...register('phone')} placeholder="+44 7..." className="mt-1" disabled={isPending} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
                  Address
                </label>
                <Input
                  {...register('address')}
                  placeholder="123 River St, Springfield"
                  className="mt-1"
                  disabled={isPending}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? 'Creating…' : 'Create client'}
              </Button>
            </form>
          ) : null}
        </div>

      </div>
    </WizardLayout>
  );
}
