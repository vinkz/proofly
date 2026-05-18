'use client';

import { useMemo, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sendEngineerRequestLinkToLandlord } from '@/server/job-requests';

function normalizePhoneForWhatsapp(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 7) return '';
  if (digits.startsWith('44')) return digits;
  if (digits.startsWith('0')) return `44${digits.slice(1)}`;
  return digits;
}

export function SendRequestLinkCard({ requestUrl }: { requestUrl: string }) {
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const trimmedContact = contact.trim();
  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedContact);
  const whatsappPhone = normalizePhoneForWhatsapp(trimmedContact);

  const whatsappUrl = useMemo(() => {
    if (!whatsappPhone || looksLikeEmail) return '';
    const text = [
      'Hi,',
      '',
      'Please send your property and access details through my CertNow request link:',
      requestUrl,
    ].join('\n');
    return `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(text)}`;
  }, [looksLikeEmail, requestUrl, whatsappPhone]);

  const canSend = looksLikeEmail || Boolean(whatsappUrl);
  const actionLabel = looksLikeEmail ? 'Send to email' : whatsappUrl ? 'Send via WhatsApp' : 'Enter email or mobile';

  return (
    <div className="mt-4 space-y-2 text-left">
      <Input
        value={contact}
        onChange={(event) => setContact(event.target.value)}
        placeholder="Landlord email or mobile number"
        inputMode="email"
        className="h-10 rounded-[10px]"
        disabled={isPending}
      />
      <Button
        type="button"
        className="h-10 w-full rounded-[10px]"
        disabled={isPending || !canSend}
        onClick={() => {
          setMessage(null);
          setError(null);

          if (looksLikeEmail) {
            startTransition(async () => {
              try {
                const result = await sendEngineerRequestLinkToLandlord({
                  landlordEmail: trimmedContact,
                });
                setMessage(
                  result.status === 'sent'
                    ? 'Request link sent by email.'
                    : 'Email delivery is not configured, but your request link is ready.',
                );
              } catch (sendError) {
                setError(sendError instanceof Error ? sendError.message : 'Could not send request link.');
              }
            });
            return;
          }

          if (whatsappUrl) {
            window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
            setMessage('WhatsApp opened with your request link.');
          }
        }}
      >
        {isPending ? 'Sending...' : actionLabel}
      </Button>
      {message ? <p className="text-center text-[13px] font-medium text-[var(--color-action)]">{message}</p> : null}
      {error ? <p className="text-center text-[13px] font-medium text-[var(--color-red)]">{error}</p> : null}
    </div>
  );
}
