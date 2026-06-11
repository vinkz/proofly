'use client';

import { useState, useTransition } from 'react';

import { submitPrefillForm } from '@/server/jobs';
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
      <FormSection title="Job address">
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Input name="jobAddressName" placeholder="Property name / reference" className="rounded-[10px] sm:col-span-2" />
          <Input name="jobAddressLine1" required placeholder="Address line 1" className="rounded-[10px] sm:col-span-2" />
          <Input name="jobAddressLine2" placeholder="Address line 2" className="rounded-[10px] sm:col-span-2" />
          <Input name="jobAddressCity" required placeholder="City / town" className="rounded-[10px]" />
          <Input name="jobPostcode" required placeholder="Postcode" className="rounded-[10px]" />
          <Input name="jobTel" placeholder="Site telephone" className="rounded-[10px]" />
        </div>
      </FormSection>

      <FormSection title="Landlord / property owner">
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Input name="landlordName" required placeholder="Name" className="rounded-[10px]" />
          <Input name="landlordCompany" placeholder="Company (optional)" className="rounded-[10px]" />
          <Input name="landlordEmail" type="email" placeholder="Email" className="rounded-[10px]" />
          <Input name="landlordTel" type="tel" placeholder="Phone" className="rounded-[10px]" />
          <Input name="landlordAddressLine1" required placeholder="Address line 1" className="rounded-[10px] sm:col-span-2" />
          <Input name="landlordAddressLine2" placeholder="Address line 2" className="rounded-[10px] sm:col-span-2" />
          <Input name="landlordCity" required placeholder="City / town" className="rounded-[10px]" />
          <Input name="landlordPostcode" required placeholder="Postcode" className="rounded-[10px]" />
        </div>
      </FormSection>

      <FormSection title="Access details">
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Input name="tenantName" placeholder="Tenant name (optional)" className="rounded-[10px]" />
          <Input name="tenantPhone" placeholder="Tenant phone (optional)" className="rounded-[10px]" />
          <Input name="preferredDates" type="date" className="rounded-[10px]" />
          <Input name="accessNotes" placeholder="Access notes" className="rounded-[10px] sm:col-span-2" />
        </div>
      </FormSection>

      <button
        type="submit"
        disabled={isPending}
        className="flex h-[44px] w-full items-center justify-center gap-[6px] rounded-[10px] bg-[#111] text-[14px] font-medium text-white disabled:opacity-50"
      >
        {isPending ? 'Sending…' : 'Send details to engineer'}
        {!isPending && (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        )}
      </button>

      {message ? (
        <div className="rounded-[10px] bg-[var(--color-action-bg)] px-4 py-3 text-[13px] font-medium text-[var(--color-action)]">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-[10px] bg-[var(--color-red-bg)] px-4 py-3 text-[13px] font-medium text-[var(--color-red)]">
          {error}
        </div>
      ) : null}
    </form>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-[12px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]">{title}</p>
      {children}
    </div>
  );
}
