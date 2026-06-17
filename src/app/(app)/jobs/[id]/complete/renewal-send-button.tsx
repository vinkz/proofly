'use client';

import { useState, useTransition } from 'react';

import { sendLandlordRenewalRequest, type RenewalSendResult } from '@/server/renewals';

const MESSAGES: Record<RenewalSendResult['status'], { text: string; tone: 'ok' | 'error' }> = {
  sent: { text: 'Renewal request sent to the landlord.', tone: 'ok' },
  missing_recipient: { text: 'No landlord email on file — add one to send.', tone: 'error' },
  not_configured: { text: 'Email is not configured yet.', tone: 'error' },
  failed: { text: 'Could not send the request. Try again.', tone: 'error' },
};

const formatNice = (value: string | null | undefined) => {
  if (!value) return null;
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

export function RenewalSendButton({
  jobId,
  hasLandlordEmail,
  bookedDate = null,
  requestedAt = null,
}: {
  jobId: string;
  hasLandlordEmail: boolean;
  bookedDate?: string | null;
  requestedAt?: string | null;
}) {
  const [result, setResult] = useState<RenewalSendResult['status'] | null>(null);
  const [isPending, startTransition] = useTransition();

  const sent = result === 'sent';
  const message = result ? MESSAGES[result] : null;

  // Once the landlord books a date the renewal is settled — show the confirmed date and stop
  // offering the send action (matches the reminder cron's stop-condition).
  if (bookedDate) {
    return (
      <div className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-[var(--color-action-bg)] px-3 py-2 text-[13px] font-medium text-[var(--color-action)]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        Booked for {formatNice(bookedDate)}
      </div>
    );
  }

  const requestedLabel = !sent && requestedAt ? formatNice(requestedAt) : null;

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={isPending || sent}
        onClick={() => {
          setResult(null);
          startTransition(async () => {
            try {
              const outcome = await sendLandlordRenewalRequest(jobId);
              setResult(outcome.status);
            } catch {
              setResult('failed');
            }
          });
        }}
        className="inline-flex h-[36px] w-full items-center justify-center rounded-[10px] bg-[var(--color-action-bg)] px-3 text-[13px] font-medium text-[var(--color-action)] transition-opacity hover:opacity-80 disabled:opacity-50"
      >
        {sent
          ? 'Renewal request sent ✓'
          : isPending
            ? 'Sending…'
            : requestedLabel
              ? 'Resend renewal request'
              : 'Send renewal request to landlord'}
      </button>
      {requestedLabel && !message ? (
        <p className="mt-1.5 text-[12px] text-[var(--color-text-tertiary)]">
          Request sent {requestedLabel} — awaiting the landlord. You can resend a reminder.
        </p>
      ) : null}
      {!hasLandlordEmail && !message ? (
        <p className="mt-1.5 text-[12px] text-[var(--color-text-tertiary)]">
          Add a landlord email on the job to enable this.
        </p>
      ) : null}
      {message ? (
        <p
          className={`mt-1.5 text-[12px] ${
            message.tone === 'ok' ? 'text-[var(--color-action)]' : 'text-[var(--color-red)]'
          }`}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
