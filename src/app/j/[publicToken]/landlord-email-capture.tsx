'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { capturePublicJobLandlordEmail } from '@/server/public-job';

export function LandlordEmailCapture({ token }: { token: string }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="mt-4 flex flex-col gap-2 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setMessage(null);
        startTransition(async () => {
          try {
            const result = await capturePublicJobLandlordEmail({ token, email });
            const dueText = result.nextInspectionDue ? ` before ${result.nextInspectionDue}` : ' before the next inspection is due';
            const contact = result.engineer?.phone || result.engineer?.email ? ` Engineer contact: ${result.engineer.phone ?? result.engineer.email}.` : '';
            setMessage(`Reminder email saved. We will use it for renewal reminders${dueText}.${contact}`);
            setEmail('');
          } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Could not save email.');
          }
        });
      }}
    >
      <Input
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="landlord@email.com"
        className="rounded-full bg-white"
      />
      <Button type="submit" disabled={isPending} className="rounded-full">
        {isPending ? 'Saving…' : 'Send reminders'}
      </Button>
      {message ? <p className="text-sm text-emerald-700 sm:col-span-2">{message}</p> : null}
      {error ? <p className="text-sm text-red-700 sm:col-span-2">{error}</p> : null}
    </form>
  );
}
