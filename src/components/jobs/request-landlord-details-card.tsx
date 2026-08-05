'use client';

import { useMemo, useState, useTransition } from 'react';

import { Input } from '@/components/ui/input';
import { toUserMessage } from '@/lib/user-errors';
import { sendEngineerRequestLinkToLandlord } from '@/server/job-requests';

type Channel = 'email' | 'sms' | 'both';

const CHANNELS: Array<{ value: Channel; label: string }> = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'both', label: 'Both' },
];

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
  const [channel, setChannel] = useState<Channel>('email');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Set once the email half of a "both" send lands, so the SMS step can be offered as the follow-up.
  const [smsPending, setSmsPending] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Use NEXT_PUBLIC_SHARE_URL as the base so the displayed link shows certnow.uk not localhost
  const shareBase = process.env.NEXT_PUBLIC_SHARE_URL?.replace(/\/$/, '');
  const displayUrl = shareBase ? requestUrl.replace(/^https?:\/\/[^/]+/, shareBase) : requestUrl;
  const shareText = `Please fill in the job details for my CertNow request: ${displayUrl}`;

  const trimmedEmail = landlordEmail.trim();
  const trimmedPhone = landlordPhone.trim();

  // `?&body=` is the cross-platform form that both iOS and Android accept — do not "tidy" it to `?body=`.
  const smsHref = useMemo(
    () =>
      trimmedPhone
        ? `sms:${trimmedPhone.replace(/\s+/g, '')}?&body=${encodeURIComponent(shareText)}`
        : null,
    [trimmedPhone, shareText],
  );

  const needsEmail = channel === 'email' || channel === 'both';
  const needsPhone = channel === 'sms' || channel === 'both';
  const canSend = (!needsEmail || Boolean(trimmedEmail)) && (!needsPhone || Boolean(trimmedPhone));

  const missingLabel = (() => {
    if (needsEmail && !trimmedEmail && needsPhone && !trimmedPhone) return 'Add an email address and a phone number.';
    if (needsEmail && !trimmedEmail) return 'Add an email address to send by email.';
    if (needsPhone && !trimmedPhone) return 'Add a phone number to send by SMS.';
    return null;
  })();

  const selectChannel = (next: Channel) => {
    setChannel(next);
    setMessage(null);
    setError(null);
    setSmsPending(false);
  };

  const sendEmail = (thenOfferSms: boolean) => {
    setMessage(null);
    setError(null);
    setSmsPending(false);
    startTransition(async () => {
      try {
        const result = await sendEngineerRequestLinkToLandlord({ landlordName, landlordEmail: trimmedEmail });
        const emailLine =
          result.status === 'sent'
            ? 'Request link emailed.'
            : 'Email delivery is not configured, but your request link is ready to share.';
        if (thenOfferSms) {
          setSmsPending(true);
          setMessage(`${emailLine} Now send the text message.`);
        } else {
          setMessage(emailLine);
        }
      } catch (sendError) {
        setError(
          toUserMessage(
            sendError,
            'We could not email the request link. Copy the link or send it by SMS instead.',
          ),
        );
      }
    });
  };

  const primaryLabel = (() => {
    if (isPending) return 'Sending…';
    if (channel === 'sms') return 'Open SMS';
    if (channel === 'both') return 'Email, then SMS';
    return 'Send email';
  })();

  const primaryClass =
    'flex h-[38px] items-center justify-center rounded-[10px] bg-[#111] px-4 text-[13px] font-medium text-white disabled:opacity-50';

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

      <div className="mt-3 flex items-center gap-2" role="group" aria-label="How to send the request link">
        {CHANNELS.map((option) => {
          const active = channel === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              disabled={isPending}
              onClick={() => selectChannel(option.value)}
              className={`h-8 rounded-full border-[0.5px] px-3.5 text-[13px] font-medium transition-colors disabled:opacity-50 ${
                active
                  ? 'border-[var(--color-action)] bg-[var(--color-action-bg)] text-[var(--color-action)]'
                  : 'border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] text-[var(--color-text-secondary)]'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="mt-2.5 grid gap-2 sm:grid-cols-[1fr,1fr,1fr,auto]">
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
          placeholder={needsEmail ? 'Landlord email' : 'Landlord email (optional)'}
          type="email"
          className="h-[38px] rounded-[10px]"
          disabled={isPending}
        />
        <Input
          value={landlordPhone}
          onChange={(event) => setLandlordPhone(event.target.value)}
          placeholder={needsPhone ? 'Phone for SMS' : 'Phone (optional)'}
          type="tel"
          className="h-[38px] rounded-[10px]"
          disabled={isPending}
        />

        {channel === 'sms' ? (
          <a
            href={canSend && smsHref ? smsHref : undefined}
            aria-disabled={!canSend}
            className={`${primaryClass} ${canSend ? '' : 'pointer-events-none opacity-50'}`}
            onClick={() => {
              setError(null);
              setMessage('Opening your messaging app…');
            }}
          >
            {primaryLabel}
          </a>
        ) : (
          <button
            type="button"
            className={primaryClass}
            disabled={isPending || !canSend}
            onClick={() => sendEmail(channel === 'both')}
          >
            {primaryLabel}
          </button>
        )}
      </div>

      {missingLabel ? (
        <p className="mt-2 text-[12px] text-[var(--color-text-tertiary)]">{missingLabel}</p>
      ) : null}

      {smsPending && smsHref ? (
        <a
          href={smsHref}
          className="mt-2.5 inline-flex h-9 items-center justify-center rounded-[18px] border-[0.5px] border-[var(--color-action)] bg-[var(--color-action-bg)] px-4 text-[13px] font-medium text-[var(--color-action)]"
          onClick={() => setSmsPending(false)}
        >
          Open SMS to {trimmedPhone}
        </a>
      ) : null}

      {message ? (
        <p className="mt-2.5 text-[13px] font-medium text-[var(--color-action)]">{message}</p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2.5 text-[13px] font-medium text-[var(--color-red)]">{error}</p>
      ) : null}
    </section>
  );
}
