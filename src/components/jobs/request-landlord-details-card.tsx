'use client';

import { useState, useTransition } from 'react';

import { Input } from '@/components/ui/input';
import { sendEngineerRequestLinkToLandlord } from '@/server/job-requests';

export function RequestLandlordDetailsCard({
  requestUrl,
  initialLandlordName = '',
  initialLandlordEmail = '',
  initialLandlordPhone = '',
}: {
  requestUrl: string;
  initialLandlordName?: string;
  initialLandlordEmail?: string;
  initialLandlordPhone?: string;
}) {
  const [landlordName, setLandlordName] = useState(initialLandlordName);
  const [landlordEmail, setLandlordEmail] = useState(initialLandlordEmail);
  const [landlordPhone, setLandlordPhone] = useState(initialLandlordPhone);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Use NEXT_PUBLIC_SHARE_URL as the base so the displayed link shows certnow.uk not localhost
  const shareBase = process.env.NEXT_PUBLIC_SHARE_URL?.replace(/\/$/, '');
  const displayUrl = shareBase ? requestUrl.replace(/^https?:\/\/[^/]+/, shareBase) : requestUrl;
  const shareText = `Please fill in the job details for my CertNow request: ${displayUrl}`;
  const smsHref = landlordPhone.trim()
    ? `sms:${encodeURIComponent(landlordPhone.trim())}?&body=${encodeURIComponent(shareText)}`
    : null;

  return (
    <section className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[var(--color-action-bg)] text-[var(--color-action)]">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-[var(--color-text-primary)]">Ask the landlord to fill details</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
            Send your request link so the landlord can enter property and access details directly.
          </p>
          <p className="mt-2 truncate rounded-[8px] bg-[var(--color-background-secondary)] px-2.5 py-1.5 text-[12px] text-[var(--color-text-tertiary)]">
            {displayUrl}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr,1fr,1fr,auto]">
        <Input
          value={landlordName}
          onChange={(event) => setLandlordName(event.target.value)}
          placeholder="Landlord name"
          className="h-[38px] rounded-[10px]"
          disabled={isPending}
        />
        <Input
          value={landlordEmail}
          onChange={(event) => setLandlordEmail(event.target.value)}
          placeholder="Landlord email"
          type="email"
          className="h-[38px] rounded-[10px]"
          disabled={isPending}
        />
        <Input
          value={landlordPhone}
          onChange={(event) => setLandlordPhone(event.target.value)}
          placeholder="Phone for SMS"
          type="tel"
          className="h-[38px] rounded-[10px]"
          disabled={isPending}
        />
        <button
          type="button"
          className="h-[38px] rounded-[10px] bg-[#111] px-4 text-[13px] font-medium text-white disabled:opacity-50"
          disabled={isPending || !landlordEmail}
          onClick={() => {
            setMessage(null);
            setError(null);
            startTransition(async () => {
              try {
                const result = await sendEngineerRequestLinkToLandlord({ landlordName, landlordEmail });
                setMessage(
                  result.status === 'sent'
                    ? 'Request link sent.'
                    : 'Email delivery is not configured, but your request link is ready to share.',
                );
              } catch (sendError) {
                setError(sendError instanceof Error ? sendError.message : 'Could not send request link.');
              }
            });
          }}
        >
          {isPending ? 'Sending…' : 'Send'}
        </button>
      </div>
      {smsHref ? (
        <a
          href={smsHref}
          className="mt-2.5 inline-flex h-9 items-center justify-center rounded-[18px] border-[0.5px] border-[var(--color-border-secondary)] px-4 text-[13px] font-medium text-[var(--color-text-primary)]"
        >
          Send by SMS
        </a>
      ) : null}
      {message ? (
        <p className="mt-2.5 text-[13px] font-medium text-[var(--color-action)]">{message}</p>
      ) : null}
      {error ? (
        <p className="mt-2.5 text-[13px] font-medium text-[var(--color-red)]">{error}</p>
      ) : null}
    </section>
  );
}
