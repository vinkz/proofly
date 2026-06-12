'use client';

import { useState, useTransition } from 'react';
import { submitPropertyRenewalRequest } from '@/server/public-property';

const toDateOnly = (value: string) => {
  const slice = String(value ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(slice) ? slice : '';
};

const todayDateOnly = () => new Date().toISOString().slice(0, 10);

export function PropertyRenewalForm({
  token,
  ctaLabel = 'Request renewal',
  defaultDate = '',
  confirmMode = true,
}: {
  token: string;
  ctaLabel?: string;
  defaultDate?: string;
  confirmMode?: boolean;
}) {
  const [tenantName, setTenantName] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [accessNotes, setAccessNotes] = useState('');
  // Pre-fill the date to the property's next-service-due (or today) so the landlord confirms it in
  // one tap rather than hunting through the calendar.
  const [preferredDate, setPreferredDate] = useState(() => toDateOnly(defaultDate) || todayDateOnly());
  const [preferredDates, setPreferredDates] = useState('');
  const [scheduled, setScheduled] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (success) {
    return (
      <div className="rounded-[12px] bg-[var(--color-action-bg)] p-4">
        <p className="text-[14px] font-medium text-[var(--color-action)]">
          {scheduled ? 'Date confirmed' : 'Request sent'}
        </p>
        <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
          {scheduled
            ? 'Your engineer has been notified and will book the visit for the date you chose.'
            : 'Your engineer has been notified and will be in touch soon.'}
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
            const result = await submitPropertyRenewalRequest({
              token,
              tenantName,
              tenantPhone,
              accessNotes,
              preferredDate,
              preferredDates,
            });
            setScheduled(Boolean(result?.scheduled));
            setSuccess(true);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not send request.');
          }
        });
      }}
    >
      <input type="text" placeholder="Tenant name" value={tenantName} onChange={(e) => setTenantName(e.target.value)} className={inputClass} />
      <input type="tel" inputMode="tel" autoComplete="off" placeholder="Tenant phone" value={tenantPhone} onChange={(e) => setTenantPhone(e.target.value)} className={inputClass} />
      <textarea placeholder="Access notes (key box, parking, etc.)" value={accessNotes} onChange={(e) => setAccessNotes(e.target.value)} rows={2} className={`${inputClass} resize-none`} />
      <div>
        <label className="mb-1 block text-[12px] font-medium text-[var(--color-text-secondary)]">
          {confirmMode ? 'Confirm a date' : 'Preferred date'}
        </label>
        <input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} className={inputClass} />
      </div>
      <input type="text" placeholder="Other notes on timing (optional)" value={preferredDates} onChange={(e) => setPreferredDates(e.target.value)} className={inputClass} />
      {error ? <p className="text-[12px] text-[var(--color-red)]">{error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-10 w-full items-center justify-center rounded-[12px] bg-[var(--color-cta)] text-[14px] font-medium text-[var(--color-cta-fg)] disabled:opacity-50"
      >
        {isPending ? 'Sending…' : confirmMode ? 'Confirm date with your engineer →' : ctaLabel}
      </button>
    </form>
  );
}
