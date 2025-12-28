'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';

import type { ClientListItem } from '@/types/client';
import { createClient } from '@/server/clients';
import { assignClientToJob, createJob, saveJobFields } from '@/server/certificates';
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

type BreakdownClientStepProps = {
  clients: ClientListItem[];
  totalSteps: number;
};

export function BreakdownClientStep({ clients, totalSteps }: BreakdownClientStepProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [clientOptions, setClientOptions] = useState(clients);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [breakdownInfo, setBreakdownInfo] = useState({
    customer_name: '',
    property_address: '',
    postcode: '',
    customer_phone: '',
    customer_email: '',
  });
  const { register, handleSubmit, reset } = useForm<ClientFormValues>({
    defaultValues: { name: '', organization: '', email: '', phone: '', address: '' },
  });

  const addClientValue = '__add_client__';

  const redirectToWizard = (jobId: string) => {
    router.push(`/wizard/create/breakdown?jobId=${jobId}&clientStep=1`);
  };

  const findClient = (clientId: string) =>
    clientOptions.find(
      (client) => client.id === clientId || (client.client_ids ?? []).includes(clientId),
    ) ?? null;

  const applyClientDefaults = (client: ClientListItem | null) => {
    if (!client) return;
    setBreakdownInfo((prev) => ({
      customer_name: prev.customer_name.trim() || client.name || '',
      property_address: prev.property_address.trim() || client.address || '',
      postcode: prev.postcode.trim() || client.postcode || '',
      customer_phone: prev.customer_phone,
      customer_email: prev.customer_email,
    }));
  };

  const handleSelect = (clientId: string) => {
    startTransition(async () => {
      try {
        setShowNewClientForm(false);
        const client = findClient(clientId);
        if (jobId) {
          await assignClientToJob({ jobId, clientId });
          applyClientDefaults(client);
          pushToast({ title: 'Client selected', variant: 'success' });
          return;
        }
        const { jobId: createdJobId } = await createJob({ certificateType: 'breakdown', clientId });
        setJobId(createdJobId);
        applyClientDefaults(client);
        pushToast({ title: 'Client selected', variant: 'success' });
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
        if (jobId) {
          await assignClientToJob({ jobId, clientId: id });
          setShowNewClientForm(false);
          applyClientDefaults(newClient);
          pushToast({ title: 'Client created', variant: 'success' });
          reset();
          return;
        }
        const { jobId: createdJobId } = await createJob({ certificateType: 'breakdown', clientId: id });
        setJobId(createdJobId);
        setShowNewClientForm(false);
        applyClientDefaults(newClient);
        pushToast({ title: 'Client created', variant: 'success' });
        reset();
      } catch (error) {
        pushToast({
          title: 'Unable to create client',
          description: error instanceof Error ? error.message : 'Check details and try again.',
          variant: 'error',
        });
      }
    });
  });

  const hasContact = breakdownInfo.customer_phone.trim().length > 0 || breakdownInfo.customer_email.trim().length > 0;
  const canContinue =
    breakdownInfo.customer_name.trim().length > 0 &&
    breakdownInfo.property_address.trim().length > 0 &&
    breakdownInfo.postcode.trim().length > 0 &&
    hasContact;

  const handleContinue = () => {
    if (!jobId) {
      pushToast({ title: 'Select a client first', description: 'Choose a client to continue.', variant: 'error' });
      return;
    }
    startTransition(async () => {
      try {
        await saveJobFields({
          jobId,
          fields: {
            customer_name: breakdownInfo.customer_name,
            property_address: breakdownInfo.property_address,
            postcode: breakdownInfo.postcode,
            customer_phone: breakdownInfo.customer_phone,
            customer_email: breakdownInfo.customer_email,
            job_address_line1: breakdownInfo.property_address,
            job_postcode: breakdownInfo.postcode,
          },
        });
        redirectToWizard(jobId);
      } catch (error) {
        pushToast({
          title: 'Unable to save job info',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  return (
    <WizardLayout step={1} total={totalSteps} title="Select or create client" status="Client">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--accent)]">Step 1</p>
          <p className="text-sm text-muted-foreground/70">Pick a client to prefill contact details.</p>
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
              <p className="text-xs text-muted-foreground/60">No clients yet. Choose Add client to enter details.</p>
            ) : null}
          </div>

          {showNewClientForm ? (
            <form onSubmit={onSubmit} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Name</label>
                <Input {...register('name')} placeholder="Client name" required className="mt-1" disabled={isPending} />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Company</label>
                <Input {...register('organization')} placeholder="Company (optional)" className="mt-1" disabled={isPending} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Email</label>
                  <Input
                    type="email"
                    {...register('email')}
                    placeholder="client@example.com"
                    className="mt-1"
                    disabled={isPending}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Phone</label>
                  <Input {...register('phone')} placeholder="+44 7..." className="mt-1" disabled={isPending} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Address</label>
                <Input {...register('address')} placeholder="123 River St, Springfield" className="mt-1" disabled={isPending} />
              </div>
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? 'Creating…' : 'Create client'}
              </Button>
            </form>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/20 bg-white/70 p-4 shadow-inner">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={breakdownInfo.customer_name}
              onChange={(e) => setBreakdownInfo((prev) => ({ ...prev, customer_name: e.target.value }))}
              placeholder="Customer name"
              disabled={!jobId}
            />
            <Input
              value={breakdownInfo.property_address}
              onChange={(e) => setBreakdownInfo((prev) => ({ ...prev, property_address: e.target.value }))}
              placeholder="Property address"
              className="sm:col-span-2"
              disabled={!jobId}
            />
            <Input
              value={breakdownInfo.postcode}
              onChange={(e) => setBreakdownInfo((prev) => ({ ...prev, postcode: e.target.value }))}
              placeholder="Postcode"
              disabled={!jobId}
            />
            <Input
              value={breakdownInfo.customer_phone}
              onChange={(e) => setBreakdownInfo((prev) => ({ ...prev, customer_phone: e.target.value }))}
              placeholder="Customer phone"
              disabled={!jobId}
            />
            <Input
              value={breakdownInfo.customer_email}
              onChange={(e) => setBreakdownInfo((prev) => ({ ...prev, customer_email: e.target.value }))}
              placeholder="Customer email (optional)"
              disabled={!jobId}
            />
          </div>
          {!canContinue ? (
            <p className="mt-3 text-xs text-red-600">
              Add customer name, property address, postcode, and phone or email to continue.
            </p>
          ) : null}
          <div className="mt-4 flex justify-end">
            <Button onClick={handleContinue} disabled={isPending || !jobId || !canContinue}>
              Continue to breakdown details
            </Button>
          </div>
        </div>
      </div>
    </WizardLayout>
  );
}
