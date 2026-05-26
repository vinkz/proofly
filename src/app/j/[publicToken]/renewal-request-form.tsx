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
    return (
      <div className="mt-3 rounded-[12px] bg-[var(--color-action-bg)] p-4">
        <p className="text-[14px] font-medium text-[var(--color-action)]">{message}</p>
      </div>
    );
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
      <Input
        value={tenantName}
        onChange={(event) => setTenantName(event.target.value)}
        placeholder="Tenant name"
        className="rounded-[10px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)]"
      />
      <Input
        value={tenantPhone}
        onChange={(event) => setTenantPhone(event.target.value)}
        placeholder="Tenant phone"
        className="rounded-[10px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)]"
      />
      <Textarea
        value={accessNotes}
        onChange={(event) => setAccessNotes(event.target.value)}
        placeholder="Access notes"
        className="rounded-[10px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)]"
      />
      <Textarea
        value={preferredDates}
        onChange={(event) => setPreferredDates(event.target.value)}
        placeholder="Preferred dates"
        className="rounded-[10px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)]"
      />
      <Button type="submit" disabled={isPending} className="rounded-full">
        {isPending ? 'Sending…' : 'Request renewal'}
      </Button>
      {error ? <p className="text-[12px] text-[var(--color-red)]">{error}</p> : null}
    </form>
  );
}
