'use client';

import { useState, useTransition } from 'react';

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
      <div className="rounded-[10px] bg-[#edf7f2] p-4">
        <p className="text-[14px] font-medium text-[#1a7a52]">{message}</p>
      </div>
    );
  }

  const fieldClass =
    'w-full rounded-[8px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-[14px] py-[11px] text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-action)] focus:outline-none';

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            const result = await submitPublicJobRenewalRequest({
              token,
              tenantName,
              tenantPhone,
              accessNotes,
              preferredDates,
            });
            const contact =
              result.engineer?.phone || result.engineer?.email
                ? ` ${result.engineer.phone ?? result.engineer.email}`
                : '';
            setMessage(
              `Request sent. Your engineer has the access details and will be in touch.${contact}`,
            );
          } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Could not send request.');
          }
        });
      }}
    >
      <input
        type="text"
        value={tenantName}
        onChange={(event) => setTenantName(event.target.value)}
        placeholder="Tenant name"
        className={fieldClass}
      />
      <input
        type="tel"
        value={tenantPhone}
        onChange={(event) => setTenantPhone(event.target.value)}
        placeholder="Tenant phone"
        className={fieldClass}
      />
      <textarea
        value={accessNotes}
        onChange={(event) => setAccessNotes(event.target.value)}
        placeholder="Access notes (key safe code, gate code, etc.)"
        rows={3}
        className={`${fieldClass} min-h-[70px] resize-none`}
      />
      <input
        type="text"
        value={preferredDates}
        onChange={(event) => setPreferredDates(event.target.value)}
        placeholder="Preferred dates"
        className={fieldClass}
      />
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-[24px] bg-[#111] px-5 py-[13px] text-[15px] font-medium text-white disabled:opacity-50"
      >
        {isPending ? 'Sending…' : 'Send to your engineer →'}
      </button>
      {error ? <p className="text-[12px] text-[#a32d2d]">{error}</p> : null}
    </form>
  );
}
