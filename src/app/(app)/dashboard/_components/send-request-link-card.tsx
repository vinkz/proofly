'use client';

import { useMemo, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sendEngineerRequestLinkToLandlord } from '@/server/job-requests';

function normalizePhoneForWhatsapp(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('44')) return digits;
  if (digits.startsWith('0')) return `44${digits.slice(1)}`;
  return digits;
}

export function SendRequestLinkCard({ requestUrl }: { requestUrl: string }) {
  const [landlordName, setLandlordName] = useState('');
  const [landlordEmail, setLandlordEmail] = useState('');
  const [landlordPhone, setLandlordPhone] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const whatsappUrl = useMemo(() => {
    const phone = normalizePhoneForWhatsapp(landlordPhone);
    if (!phone) return '';
    const text = [
      landlordName.trim() ? `Hi ${landlordName.trim()},` : 'Hi,',
      '',
      'Please send your property and access details through my CertNow request link:',
      requestUrl,
    ].join('\n');
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  }, [landlordName, landlordPhone, requestUrl]);

  const canSend = Boolean(landlordEmail.trim() || whatsappUrl);

  return (
    <div className="mt-4 space-y-2 text-left">
      <Input
        value={landlordName}
        onChange={(event) => setLandlordName(event.target.value)}
        placeholder="Landlord name"
        className="h-10 rounded-[10px]"
        disabled={isPending}
      />
      <Input
        value={landlordEmail}
        onChange={(event) => setLandlordEmail(event.target.value)}
        placeholder="Landlord email"
        type="email"
        className="h-10 rounded-[10px]"
        disabled={isPending}
      />
      <Input
        value={landlordPhone}
        onChange={(event) => setLandlordPhone(event.target.value)}
        placeholder="Mobile number"
        type="tel"
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

          if (landlordEmail.trim()) {
            startTransition(async () => {
              try {
                const result = await sendEngineerRequestLinkToLandlord({
                  landlordName,
                  landlordEmail,
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
        {isPending ? 'Sending...' : landlordEmail.trim() ? 'Send email' : 'Send by WhatsApp'}
      </Button>
      {message ? <p className="text-center text-[13px] font-medium text-[var(--color-action)]">{message}</p> : null}
      {error ? <p className="text-center text-[13px] font-medium text-[var(--color-red)]">{error}</p> : null}
    </div>
  );
}
