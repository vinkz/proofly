'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { submitPublicJobRenewalRequest } from '@/server/public-job';

export function RenewalRequestForm({ token }: { token: string }) {
  const [tenantName, setTenantName] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [accessNotes, setAccessNotes] = useState('');
  const [preferredDates, setPreferredDates] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (message) {
    return <p className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>;
  }

  return (
    <form
      className="mt-4 grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            const result = await submitPublicJobRenewalRequest({ token, tenantName, tenantPhone, accessNotes, preferredDates });
            const contact = result.engineer?.phone || result.engineer?.email ? ` ${result.engineer.phone ?? result.engineer.email}` : '';
            setMessage(`Renewal request sent. Your engineer has the access details and will contact you.${contact}`);
          } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Could not send request.');
          }
        });
      }}
    >
      <Input value={tenantName} onChange={(event) => setTenantName(event.target.value)} placeholder="Tenant name" className="rounded-2xl bg-white" />
      <Input value={tenantPhone} onChange={(event) => setTenantPhone(event.target.value)} placeholder="Tenant phone" className="rounded-2xl bg-white" />
      <Textarea value={accessNotes} onChange={(event) => setAccessNotes(event.target.value)} placeholder="Access notes" className="rounded-2xl bg-white" />
      <Textarea value={preferredDates} onChange={(event) => setPreferredDates(event.target.value)} placeholder="Preferred dates" className="rounded-2xl bg-white" />
      <Button type="submit" disabled={isPending} className="rounded-full">
        {isPending ? 'Sending…' : 'Request renewal'}
      </Button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </form>
  );
}
