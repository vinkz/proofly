'use client';

import { useState, useTransition } from 'react';

import { submitPrefillForm } from '@/server/jobs';
import { AddressAutocompleteField } from '@/components/address/address-autocomplete-field';
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

  // Address blocks are controlled so the lookup can fill the sibling fields;
  // the name attributes keep them visible to the FormData submit below.
  const [jobAddressLine1, setJobAddressLine1] = useState('');
  const [jobAddressLine2, setJobAddressLine2] = useState('');
  const [jobAddressCity, setJobAddressCity] = useState('');
  const [jobPostcode, setJobPostcode] = useState('');
  const [landlordAddressLine1, setLandlordAddressLine1] = useState('');
  const [landlordAddressLine2, setLandlordAddressLine2] = useState('');
  const [landlordCity, setLandlordCity] = useState('');
  const [landlordPostcode, setLandlordPostcode] = useState('');

  const resetAddressFields = () => {
    setJobAddressLine1('');
    setJobAddressLine2('');
    setJobAddressCity('');
    setJobPostcode('');
    setLandlordAddressLine1('');
    setLandlordAddressLine2('');
    setLandlordCity('');
    setLandlordPostcode('');
  };

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
            resetAddressFields();
          } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Could not submit details.');
          }
        });
      }}
    >
      <FormSection title="Job address">
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Input name="jobAddressName" autoComplete="off" placeholder="Property name / reference" className="rounded-[10px] sm:col-span-2" />
          <AddressAutocompleteField
            name="jobAddressLine1"
            required
            value={jobAddressLine1}
            onValueChange={setJobAddressLine1}
            onAddressSelect={(address) => {
              setJobAddressLine2(address.line2 || '');
              setJobAddressCity(address.city || '');
              setJobPostcode(address.postcode || '');
            }}
            placeholder="Address line 1"
            className="sm:col-span-2"
            inputClassName="rounded-[10px]"
          />
          <Input name="jobAddressLine2" autoComplete="off" value={jobAddressLine2} onChange={(e) => setJobAddressLine2(e.target.value)} placeholder="Address line 2" className="rounded-[10px] sm:col-span-2" />
          <Input name="jobAddressCity" required autoComplete="off" value={jobAddressCity} onChange={(e) => setJobAddressCity(e.target.value)} placeholder="City / town" className="rounded-[10px]" />
          <Input name="jobPostcode" required autoComplete="off" value={jobPostcode} onChange={(e) => setJobPostcode(e.target.value)} placeholder="Postcode" className="rounded-[10px]" />
          <Input name="jobTel" type="tel" inputMode="tel" autoComplete="off" placeholder="Site telephone" className="rounded-[10px]" />
        </div>
      </FormSection>

      <FormSection title="Landlord / property owner">
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Input name="landlordName" required autoComplete="name" placeholder="Name" className="rounded-[10px]" />
          <Input name="landlordCompany" autoComplete="organization" placeholder="Company (optional)" className="rounded-[10px]" />
          <Input name="landlordEmail" type="email" autoComplete="email" placeholder="Email" className="rounded-[10px]" />
          <Input name="landlordTel" type="tel" inputMode="tel" autoComplete="tel" placeholder="Phone" className="rounded-[10px]" />
          <AddressAutocompleteField
            name="landlordAddressLine1"
            required
            autoComplete="address-line1"
            value={landlordAddressLine1}
            onValueChange={setLandlordAddressLine1}
            onAddressSelect={(address) => {
              setLandlordAddressLine2(address.line2 || '');
              setLandlordCity(address.city || '');
              setLandlordPostcode(address.postcode || '');
            }}
            placeholder="Address line 1"
            className="sm:col-span-2"
            inputClassName="rounded-[10px]"
          />
          <Input name="landlordAddressLine2" autoComplete="address-line2" value={landlordAddressLine2} onChange={(e) => setLandlordAddressLine2(e.target.value)} placeholder="Address line 2" className="rounded-[10px] sm:col-span-2" />
          <Input name="landlordCity" required autoComplete="address-level2" value={landlordCity} onChange={(e) => setLandlordCity(e.target.value)} placeholder="City / town" className="rounded-[10px]" />
          <Input name="landlordPostcode" required autoComplete="postal-code" value={landlordPostcode} onChange={(e) => setLandlordPostcode(e.target.value)} placeholder="Postcode" className="rounded-[10px]" />
        </div>
      </FormSection>

      <FormSection title="Access details">
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Input name="tenantName" autoComplete="off" placeholder="Tenant name (optional)" className="rounded-[10px]" />
          <Input name="tenantPhone" type="tel" inputMode="tel" autoComplete="off" placeholder="Tenant phone (optional)" className="rounded-[10px]" />
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
