'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';

import type { CertificateType } from '@/types/certificates';
import type { ClientListItem } from '@/types/client';
import { createClient } from '@/server/clients';
import { assignClientToJob, createJob, saveCp12JobInfo } from '@/server/certificates';
import { getProfile } from '@/server/profile';
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
};

export function CertificateClientStep({ certificateType, clients, totalSteps }: CertificateClientStepProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [clientOptions, setClientOptions] = useState(clients);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [profileDefaults, setProfileDefaults] = useState({
    engineer_name: '',
    gas_safe_number: '',
    company_name: '',
  });
  const [cp12Info, setCp12Info] = useState({
    customer_name: '',
    property_address: '',
    postcode: '',
    landlord_name: '',
    landlord_address: '',
    reg_26_9_confirmed: false,
  });
  const { register, handleSubmit, reset } = useForm<ClientFormValues>({
    defaultValues: { name: '', organization: '', email: '', phone: '', address: '' },
  });

  const isCp12 = certificateType === 'cp12';
  const addClientValue = '__add_client__';

  const redirectToWizard = (jobId: string) => {
    router.push(`/wizard/create/${certificateType}?jobId=${jobId}&clientStep=1`);
  };

  const findClient = (clientId: string) =>
    clientOptions.find(
      (client) => client.id === clientId || (client.client_ids ?? []).includes(clientId),
    ) ?? null;

  const applyClientDefaults = (client: ClientListItem | null) => {
    if (!client) return;
    setCp12Info((prev) => ({
      customer_name: prev.customer_name.trim() || client.name || '',
      property_address: prev.property_address.trim() || client.address || '',
      postcode: prev.postcode.trim() || client.postcode || '',
      landlord_name: prev.landlord_name.trim() || client.landlord_name || '',
      landlord_address: prev.landlord_address.trim() || client.landlord_address || '',
      reg_26_9_confirmed: prev.reg_26_9_confirmed,
    }));
  };

  const loadProfileDefaults = async () => {
    try {
      const { profile } = await getProfile();
      setProfileDefaults({
        engineer_name: profile?.default_engineer_name ?? profile?.full_name ?? '',
        gas_safe_number: profile?.gas_safe_number ?? '',
        company_name: profile?.company_name ?? '',
      });
    } catch {
      setProfileDefaults({ engineer_name: '', gas_safe_number: '', company_name: '' });
    }
  };

  const handleSelect = (clientId: string) => {
    startTransition(async () => {
      try {
        setShowNewClientForm(false);
        const client = findClient(clientId);
        if (isCp12 && jobId) {
          await assignClientToJob({ jobId, clientId });
          applyClientDefaults(client);
          pushToast({ title: 'Client selected', variant: 'success' });
          return;
        }
        const { jobId: createdJobId } = await createJob({ certificateType, clientId });
        if (isCp12) {
          setJobId(createdJobId);
          applyClientDefaults(client);
          await loadProfileDefaults();
          pushToast({ title: 'Client selected', variant: 'success' });
          return;
        }
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

  const handleManualEntry = () => {
    if (jobId) return;
    startTransition(async () => {
      try {
        const { jobId: createdJobId } = await createJob({ certificateType });
        setJobId(createdJobId);
        setSelectedClientId('');
        setShowNewClientForm(false);
        await loadProfileDefaults();
        pushToast({ title: 'Ready for manual entry', variant: 'success' });
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
          if (jobId) {
            await assignClientToJob({ jobId, clientId: id });
          } else {
            const { jobId: createdJobId } = await createJob({ certificateType, clientId: id });
            setJobId(createdJobId);
          }
          applyClientDefaults(newClient);
          await loadProfileDefaults();
          pushToast({ title: 'Client created', variant: 'success' });
          reset();
          setShowNewClientForm(false);
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

  const handleCp12Continue = () => {
    if (!jobId) {
      pushToast({ title: 'Select a client first', description: 'Choose a client to continue.', variant: 'error' });
      return;
    }
    startTransition(async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        await saveCp12JobInfo({
          jobId,
          data: {
            customer_name: cp12Info.customer_name,
            property_address: cp12Info.property_address,
            postcode: cp12Info.postcode,
            inspection_date: today,
            landlord_name: cp12Info.landlord_name,
            landlord_address: cp12Info.landlord_address,
            reg_26_9_confirmed: cp12Info.reg_26_9_confirmed,
            engineer_name: profileDefaults.engineer_name,
            gas_safe_number: profileDefaults.gas_safe_number,
            company_name: profileDefaults.company_name,
          },
        });
        router.push(`/wizard/create/cp12?jobId=${jobId}&clientStep=1&skipJobInfo=1`);
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
                    if (isCp12) {
                      handleManualEntry();
                    } else {
                      setShowNewClientForm(true);
                    }
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

        {isCp12 ? (
          <div className="rounded-2xl border border-white/20 bg-white/70 p-4 shadow-inner">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                value={cp12Info.customer_name}
                onChange={(e) => setCp12Info((prev) => ({ ...prev, customer_name: e.target.value }))}
                placeholder="Customer name"
                disabled={!jobId}
              />
              <Input
                value={cp12Info.property_address}
                onChange={(e) => setCp12Info((prev) => ({ ...prev, property_address: e.target.value }))}
                placeholder="Property address"
                className="sm:col-span-2"
                disabled={!jobId}
              />
              <Input
                value={cp12Info.postcode}
                onChange={(e) => setCp12Info((prev) => ({ ...prev, postcode: e.target.value }))}
                placeholder="Postcode"
                disabled={!jobId}
              />
              <Input
                value={cp12Info.landlord_name}
                onChange={(e) => setCp12Info((prev) => ({ ...prev, landlord_name: e.target.value }))}
                placeholder="Landlord / Agent name"
                disabled={!jobId}
              />
              <Input
                value={cp12Info.landlord_address}
                onChange={(e) => setCp12Info((prev) => ({ ...prev, landlord_address: e.target.value }))}
                placeholder="Landlord / Agent address"
                className="sm:col-span-2"
                disabled={!jobId}
              />
              <label className="flex items-start gap-3 text-sm text-muted sm:col-span-2">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[var(--accent)]"
                  checked={cp12Info.reg_26_9_confirmed}
                  onChange={(e) => setCp12Info((prev) => ({ ...prev, reg_26_9_confirmed: e.target.checked }))}
                  disabled={!jobId}
                />
                Regulation 26(9) confirmed
              </label>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={handleCp12Continue} disabled={isPending || !jobId}>
                Continue to photos
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </WizardLayout>
  );
}
