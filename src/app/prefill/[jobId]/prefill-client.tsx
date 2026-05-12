'use client';

import { useState, useTransition } from 'react';

import { submitPrefillForm } from '@/server/jobs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function PrefillClient({
  jobId,
  token,
}: {
  jobId: string;
  token: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setMessage(null);
        setError(null);

        startTransition(async () => {
          try {
            await submitPrefillForm({
              jobId,
              token,
              jobAddressName: String(form.get('jobAddressName') ?? ''),
              jobAddressLine1: String(form.get('jobAddressLine1') ?? ''),
              jobAddressLine2: String(form.get('jobAddressLine2') ?? ''),
              jobAddressCity: String(form.get('jobAddressCity') ?? ''),
              jobPostcode: String(form.get('jobPostcode') ?? ''),
              jobTel: String(form.get('jobTel') ?? ''),
              landlordName: String(form.get('landlordName') ?? ''),
              landlordCompany: String(form.get('landlordCompany') ?? ''),
              landlordAddressLine1: String(form.get('landlordAddressLine1') ?? ''),
              landlordAddressLine2: String(form.get('landlordAddressLine2') ?? ''),
              landlordCity: String(form.get('landlordCity') ?? ''),
              landlordPostcode: String(form.get('landlordPostcode') ?? ''),
              landlordTel: String(form.get('landlordTel') ?? ''),
              landlordEmail: String(form.get('landlordEmail') ?? ''),
              tenantName: String(form.get('tenantName') ?? ''),
              tenantPhone: String(form.get('tenantPhone') ?? ''),
              accessNotes: String(form.get('accessNotes') ?? ''),
              preferredDates: String(form.get('preferredDates') ?? ''),
            });
            setMessage('Details sent. Your engineer has been notified and can prepare the job.');
            event.currentTarget.reset();
          } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Could not submit details.');
          }
        });
      }}
    >
      <section className="rounded-3xl bg-white/70 p-4">
        <p className="text-sm font-semibold">Job address</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input name="jobAddressName" placeholder="Property name / reference" className="rounded-2xl bg-white sm:col-span-2" />
          <Input name="jobAddressLine1" required placeholder="Address line 1" className="rounded-2xl bg-white sm:col-span-2" />
          <Input name="jobAddressLine2" placeholder="Address line 2" className="rounded-2xl bg-white sm:col-span-2" />
          <Input name="jobAddressCity" required placeholder="City / town" className="rounded-2xl bg-white" />
          <Input name="jobPostcode" required placeholder="Postcode" className="rounded-2xl bg-white" />
          <Input name="jobTel" placeholder="Site telephone" className="rounded-2xl bg-white" />
        </div>
      </section>

      <section className="rounded-3xl bg-white/70 p-4">
        <p className="text-sm font-semibold">Landlord / property owner</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input name="landlordName" required placeholder="Name" className="rounded-2xl bg-white" />
          <Input name="landlordCompany" placeholder="Company (optional)" className="rounded-2xl bg-white" />
          <Input name="landlordEmail" type="email" placeholder="Email" className="rounded-2xl bg-white" />
          <Input name="landlordTel" type="tel" placeholder="Phone" className="rounded-2xl bg-white" />
          <Input name="landlordAddressLine1" required placeholder="Address line 1" className="rounded-2xl bg-white sm:col-span-2" />
          <Input name="landlordAddressLine2" placeholder="Address line 2" className="rounded-2xl bg-white sm:col-span-2" />
          <Input name="landlordCity" required placeholder="City / town" className="rounded-2xl bg-white" />
          <Input name="landlordPostcode" required placeholder="Postcode" className="rounded-2xl bg-white" />
        </div>
      </section>

      <section className="rounded-3xl bg-white/70 p-4">
        <p className="text-sm font-semibold">Access details</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input name="tenantName" placeholder="Tenant name (optional)" className="rounded-2xl bg-white" />
          <Input name="tenantPhone" placeholder="Tenant phone (optional)" className="rounded-2xl bg-white" />
          <Input name="preferredDates" type="date" className="rounded-2xl bg-white" />
          <Input name="accessNotes" placeholder="Access notes" className="rounded-2xl bg-white sm:col-span-2" />
        </div>
      </section>

      <Button type="submit" disabled={isPending} className="w-full rounded-full">
        {isPending ? 'Sending...' : 'Send details to engineer'}
      </Button>
      {message ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}
    </form>
  );
}
