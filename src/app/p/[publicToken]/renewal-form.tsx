'use client';

import { useState, useTransition } from 'react';
import { submitPropertyRenewalRequest } from '@/server/public-property';

export function PropertyRenewalForm({ token, ctaLabel = 'Request renewal' }: { token: string; ctaLabel?: string }) {
  const [tenantName, setTenantName] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [accessNotes, setAccessNotes] = useState('');
  const [preferredDates, setPreferredDates] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (success) {
    return (
      <div className="rounded-[12px] bg-[var(--color-action-bg)] p-4">
        <p className="text-[14px] font-medium text-[var(--color-action)]">Request sent</p>
        <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
          Your engineer has been notified and will be in touch soon.
        </p>
      </div>
    );
  }

  const inputClass =
    'w-full rounded-[10px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2.5 text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-action)] focus:outline-none';

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            await submitPropertyRenewalRequest({ token, tenantName, tenantPhone, accessNotes, preferredDates });
            setSuccess(true);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not send request.');
          }
        });
      }}
    >
      <input type="text" placeholder="Tenant name" value={tenantName} onChange={(e) => setTenantName(e.target.value)} className={inputClass} />
      <input type="tel" placeholder="Tenant phone" value={tenantPhone} onChange={(e) => setTenantPhone(e.target.value)} className={inputClass} />
      <textarea placeholder="Access notes (key box, parking, etc.)" value={accessNotes} onChange={(e) => setAccessNotes(e.target.value)} rows={2} className={`${inputClass} resize-none`} />
      <textarea placeholder="Preferred dates" value={preferredDates} onChange={(e) => setPreferredDates(e.target.value)} rows={2} className={`${inputClass} resize-none`} />
      {error ? <p className="text-[12px] text-[var(--color-red)]">{error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-10 w-full items-center justify-center rounded-[12px] bg-[var(--color-cta)] text-[14px] font-medium text-[var(--color-cta-fg)] disabled:opacity-50"
      >
        {isPending ? 'Sending…' : ctaLabel}
      </button>
    </form>
  );
}
