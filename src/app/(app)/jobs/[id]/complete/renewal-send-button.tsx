'use client';

import { useState, useTransition } from 'react';

import { sendLandlordRenewalRequest, type RenewalSendResult } from '@/server/renewals';

const MESSAGES: Record<RenewalSendResult['status'], { text: string; tone: 'ok' | 'error' }> = {
  sent: { text: 'Renewal request sent to the landlord.', tone: 'ok' },
  missing_recipient: { text: 'No landlord email on file — add one to send.', tone: 'error' },
  not_configured: { text: 'Email is not configured yet.', tone: 'error' },
  failed: { text: 'Could not send the request. Try again.', tone: 'error' },
};

export function RenewalSendButton({ jobId, hasLandlordEmail }: { jobId: string; hasLandlordEmail: boolean }) {
  const [result, setResult] = useState<RenewalSendResult['status'] | null>(null);
  const [isPending, startTransition] = useTransition();

  const sent = result === 'sent';
  const message = result ? MESSAGES[result] : null;

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
        {sent ? 'Renewal request sent ✓' : isPending ? 'Sending…' : 'Send renewal request to landlord'}
      </button>
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
