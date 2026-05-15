'use client';

import { useState, useTransition } from 'react';

import {
  sendDeliveryBundle,
  updateDeliveryRecipientEmails,
  type DeliveryBundle,
  type DeliveryRecipient,
} from '@/server/delivery';

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

function EmailField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const trimmed = value.trim();
  const invalid = Boolean(trimmed) && !isValidEmail(trimmed);

  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-[0.4px] text-white/40">{label}</span>
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 h-[38px] w-full rounded-[9px] border-[0.5px] border-white/10 bg-white/10 px-3 text-[13px] text-white outline-none placeholder:text-white/25 focus:border-white/30"
      />
      {invalid ? <span className="mt-1 block text-[11px] text-[var(--color-red)]">Enter a valid email.</span> : null}
    </label>
  );
}

function WhatsAppButton({ bundle, recipient }: { bundle: DeliveryBundle; recipient: DeliveryRecipient }) {
  const name =
    recipient === 'tenant'
      ? (bundle.tenantName ?? 'there')
      : (bundle.landlordName ?? 'there');
  const message = [
    `Hi ${name},`,
    '',
    `Here are the gas safety documents for ${bundle.address}.`,
    '',
    `You can view and download the certificate here:`,
    `${typeof window !== 'undefined' ? window.location.origin : ''}${bundle.publicHref}`,
    '',
    `Let me know if you have any questions.`,
    bundle.engineerName ?? '',
  ]
    .join('\n')
    .trim();

  const href = `https://wa.me/?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-[44px] w-full items-center justify-center gap-2 rounded-[10px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] text-[13px] font-medium text-[var(--color-text-primary)] transition-opacity hover:opacity-80"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
      Share via WhatsApp
    </a>
  );
}

export function SendPanel({ bundle }: { bundle: DeliveryBundle }) {
  const [recipient, setRecipient] = useState<DeliveryRecipient>(
    bundle.landlordEmail ? 'landlord' : bundle.tenantEmail ? 'tenant' : 'landlord',
  );
  const [landlordEmail, setLandlordEmail] = useState(bundle.landlordEmail ?? '');
  const [tenantEmail, setTenantEmail] = useState(bundle.tenantEmail ?? '');
  const [sent, setSent] = useState(false);
  const [sentTo, setSentTo] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const recipientEmail =
    recipient === 'landlord'
      ? landlordEmail.trim()
      : recipient === 'tenant'
        ? tenantEmail.trim()
        : [landlordEmail.trim(), tenantEmail.trim()].filter(Boolean).join(' & ');
  const landlordEmailValidOrBlank = !landlordEmail.trim() || isValidEmail(landlordEmail);
  const tenantEmailValidOrBlank = !tenantEmail.trim() || isValidEmail(tenantEmail);

  const canSend = Boolean(
    (recipient === 'landlord' && isValidEmail(landlordEmail)) ||
      (recipient === 'tenant' && isValidEmail(tenantEmail)) ||
      (recipient === 'both' &&
        landlordEmailValidOrBlank &&
        tenantEmailValidOrBlank &&
        (isValidEmail(landlordEmail) || isValidEmail(tenantEmail))),
  );

  const handleSend = () => {
    setError(null);
    startTransition(async () => {
      try {
        const saveResult = await updateDeliveryRecipientEmails(bundle.jobId, {
          landlordEmail,
          tenantEmail,
        });
        if (!saveResult.ok) {
          setError(saveResult.error ?? 'Could not save recipient email.');
          return;
        }
        const result = await sendDeliveryBundle(bundle.jobId, recipient, 'email');
        if (result.ok) {
          setSent(true);
          setSentTo(result.recipientsSent);
        } else {
          setError(result.error ?? 'Send failed. Please try again.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Send failed. Please try again.');
      }
    });
  };

  if (sent) {
    return (
      <div className="rounded-[16px] bg-[#111] p-5 text-white">
        <div className="flex items-center gap-2.5">
          <span className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full bg-[var(--color-action)] text-[13px] font-bold text-white">
            ✓
          </span>
          <div>
            <p className="text-[14px] font-semibold">Sent</p>
            <p className="text-[12px] text-white/60">{sentTo.join(', ')}</p>
          </div>
        </div>
        <p className="mt-3 text-[13px] text-white/60">
          The landlord link is permanently accessible — no login required.
        </p>
        <a
          href={bundle.publicHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 block truncate text-[12px] text-white/40 underline underline-offset-2 hover:text-white/60"
        >
          {bundle.publicHref}
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-[16px] bg-[#111] p-5 text-white">
      <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-white/50">Send documents</p>
      <h2 className="mt-2 text-[18px] font-semibold">Send to recipient</h2>
      <p className="mt-1 text-[13px] text-white/60">
        Certificate PDF will be attached. Recipient gets a permanent link — no login needed.
      </p>

      {/* Recipient toggle */}
      <div className="mt-4 grid grid-cols-3 gap-1.5 rounded-[10px] bg-white/10 p-1">
        {(
          [
            { value: 'landlord', label: 'Landlord' },
            { value: 'tenant', label: 'Tenant' },
            { value: 'both', label: 'Both' },
          ] as const
        ).map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setRecipient(value)}
            className={`h-[32px] rounded-[8px] text-[12px] font-medium transition-colors ${
              recipient === value
                ? 'bg-white text-[#111]'
                : 'text-white/60 hover:text-white/90'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Recipient detail */}
      <div className="mt-3 space-y-3 rounded-[10px] border-[0.5px] border-white/10 px-3 py-3">
        {recipient === 'landlord' || recipient === 'both' ? (
          <EmailField
            label="Landlord email"
            value={landlordEmail}
            onChange={setLandlordEmail}
            placeholder="landlord@example.com"
          />
        ) : null}
        {recipient === 'tenant' || recipient === 'both' ? (
          <EmailField
            label="Tenant email"
            value={tenantEmail}
            onChange={setTenantEmail}
            placeholder="tenant@example.com"
          />
        ) : null}
        {!recipientEmail ? (
          <p className="text-[12px] text-white/35">Add an email here to send without returning to Step 1.</p>
        ) : null}
      </div>

      {error ? (
        <p className="mt-3 text-[12px] text-[var(--color-red)]">{error}</p>
      ) : null}

      <button
        type="button"
        onClick={handleSend}
        disabled={!canSend || isPending}
        className="mt-4 flex h-[44px] w-full items-center justify-center rounded-[10px] bg-white text-[14px] font-medium text-[#111] transition-opacity hover:opacity-90 disabled:opacity-30"
      >
        {isPending ? 'Sending…' : 'Send by email'}
      </button>

      <div className="mt-2.5">
        <WhatsAppButton bundle={bundle} recipient={recipient} />
      </div>

      <a
        href={bundle.publicHref}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 block truncate text-center text-[11px] text-white/30 underline-offset-2 transition-colors hover:text-white/50"
      >
        Preview recipient view ↗
      </a>
    </div>
  );
}
