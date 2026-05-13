'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sendEngineerRequestLinkToLandlord } from '@/server/job-requests';

export function RequestLandlordDetailsCard({ requestUrl }: { requestUrl: string }) {
  const [landlordName, setLandlordName] = useState('');
  const [landlordEmail, setLandlordEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <section className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-950">Ask the landlord to fill details</p>
          <p className="mt-1 text-sm text-emerald-900/75">
            Send your request link so the landlord can enter property, access, and preferred visit details without entering your engineer details.
          </p>
          <p className="mt-2 break-all rounded-2xl bg-white/80 px-3 py-2 text-xs text-emerald-900">{requestUrl}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr,1fr,auto]">
        <Input
          value={landlordName}
          onChange={(event) => setLandlordName(event.target.value)}
          placeholder="Landlord name"
          className="rounded-2xl bg-white"
          disabled={isPending}
        />
        <Input
          value={landlordEmail}
          onChange={(event) => setLandlordEmail(event.target.value)}
          placeholder="Landlord email"
          type="email"
          className="rounded-2xl bg-white"
          disabled={isPending}
        />
        <Button
          type="button"
          className="rounded-full"
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
          {isPending ? 'Sending...' : 'Send'}
        </Button>
      </div>
      {message ? <p className="mt-3 text-sm font-medium text-emerald-800">{message}</p> : null}
      {error ? <p className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}
    </section>
  );
}
