'use client';

import { useState, useTransition } from 'react';

import { capturePublicJobLandlordEmail } from '@/server/public-job';

export function LandlordEmailCapture({ token }: { token: string }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (message) {
    return (
      <div className="rounded-[10px] bg-[#edf7f2] p-3">
        <p className="text-[13px] font-medium text-[#1a7a52]">{message}</p>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setMessage(null);
        startTransition(async () => {
          try {
            const result = await capturePublicJobLandlordEmail({ token, email });
            const dueText = result.nextInspectionDue
              ? ` before ${result.nextInspectionDue}`
              : ' before the next inspection is due';
            const contact =
              result.engineer?.phone || result.engineer?.email
                ? ` Engineer contact: ${result.engineer.phone ?? result.engineer.email}.`
                : '';
            setMessage(`Reminder saved. We'll use it for renewal reminders${dueText}.${contact}`);
            setEmail('');
          } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Could not save email.');
          }
        });
      }}
    >
      <input
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="landlord@email.com"
        className="w-full rounded-[8px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-[14px] py-[11px] text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-action)] focus:outline-none"
      />
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-[24px] bg-[#111] px-5 py-[13px] text-[15px] font-medium text-white disabled:opacity-50"
      >
        {isPending ? 'Saving…' : 'Save for reminders →'}
      </button>
      {error ? <p className="text-[12px] text-[#a32d2d]">{error}</p> : null}
    </form>
  );
}
