'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { SoloJobForm, type SavedPropertyOption } from '@/components/jobs/solo-job-form';
import { createSoloJob } from '@/server/jobs';
import { ANALYTICS_EVENTS, track } from '@/lib/analytics/events';
import type { JobRequestPrefill } from '@/server/job-requests';
import type { ClientListItem } from '@/types/client';
import { JOB_TYPE_LABELS, type JobType } from '@/types/job-records';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toUserMessage } from '@/lib/user-errors';

type RequestReviewProps = {
  initialRequest: JobRequestPrefill;
  clients: ClientListItem[];
  propertiesByClientId: Record<string, SavedPropertyOption[]>;
};

const splitAddressParts = (value: string | null | undefined) =>
  String(value ?? '')
    .split(/[\r\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean);

const parseRequestAddress = (address: string | null | undefined, postcode: string | null | undefined) => {
  const parts = splitAddressParts(address);
  const normalizedPostcode = String(postcode ?? '').trim();
  const withoutPostcode = normalizedPostcode
    ? parts.filter((part) => part.toLowerCase() !== normalizedPostcode.toLowerCase())
    : parts;
  return {
    line1: withoutPostcode[0] ?? '',
    line2: withoutPostcode.length > 2 ? withoutPostcode.slice(1, -1).join(', ') : '',
    city: withoutPostcode.length > 1 ? withoutPostcode.at(-1) ?? '' : '',
    postcode: normalizedPostcode || parts.at(-1) || '',
  };
};

const firstDateFromPreferredDates = (value: string | null | undefined) => {
  const match = String(value ?? '').match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? '';
};

const nowForDatetimeLocal = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

// A landlord request carries "both" / "service" / "safety_check" — map it to the
// engineer-side job type. A "both" request must become a combined job so the
// requested service isn't silently dropped.
const mapRequestJobType = (value: string | null | undefined): JobType =>
  value === 'both' ? 'safety_check_service' : value === 'service' ? 'service' : 'safety_check';

const formatPreferredDate = (value: string) => {
  const iso = firstDateFromPreferredDates(value);
  if (!iso) return value.trim();
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

function DetailRow({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <div className="flex flex-col gap-0.5 border-t-[0.5px] border-[var(--color-border-tertiary)] py-2.5 first:border-t-0 sm:flex-row sm:items-baseline sm:gap-3">
      <span className="min-w-[130px] text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">
        {label}
      </span>
      <span className="text-[14px] leading-snug text-[var(--color-text-primary)]">{value}</span>
    </div>
  );
}

export function RequestReview({ initialRequest, clients, propertiesByClientId }: RequestReviewProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [mode, setMode] = useState<'review' | 'edit'>('review');
  const [isPending, startTransition] = useTransition();

  const jobType = mapRequestJobType(initialRequest.jobType);
  const address = parseRequestAddress(initialRequest.propertyAddress, initialRequest.propertyPostcode);
  const preferredIso = firstDateFromPreferredDates(initialRequest.preferredDates);
  const sitePhone = initialRequest.tenantPhone || initialRequest.landlordPhone;

  const [scheduledFor, setScheduledFor] = useState(
    preferredIso ? `${preferredIso}T09:00` : nowForDatetimeLocal(),
  );

  const propertyAddressDisplay = [
    initialRequest.propertyAddress,
    initialRequest.propertyPostcode &&
    !initialRequest.propertyAddress.toLowerCase().includes(initialRequest.propertyPostcode.toLowerCase())
      ? initialRequest.propertyPostcode
      : '',
  ]
    .filter(Boolean)
    .join(', ');

  const landlordContact = [initialRequest.landlordPhone, initialRequest.landlordEmail].filter(Boolean).join('  ·  ');

  const handleAccept = () => {
    startTransition(async () => {
      try {
        const { jobId } = await createSoloJob({
          clientMode: 'new',
          clientId: '',
          clientName: initialRequest.landlordName,
          clientPhone: initialRequest.landlordPhone,
          clientEmail: initialRequest.landlordEmail,
          propertyName: '',
          addressLine1: address.line1,
          city: address.city,
          postcode: address.postcode,
          sitePhone,
          scheduledFor,
          jobType,
          inspectionDate: preferredIso,
          jobAddressName: '',
          jobAddressLine1: address.line1,
          jobAddressLine2: address.line2,
          jobAddressCity: address.city,
          jobAddressPostcode: address.postcode,
          jobAddressTel: sitePhone,
          landlordName: initialRequest.landlordName,
          landlordCompany: initialRequest.landlordCompany,
          landlordAddressLine1: initialRequest.landlordAddressLine1,
          landlordAddressLine2: initialRequest.landlordAddressLine2,
          landlordCity: initialRequest.landlordCity,
          landlordPostcode: initialRequest.landlordPostcode,
          landlordTel: initialRequest.landlordPhone,
          selectedPropertyId: '',
          selectedPropertyJobId: '',
          requestId: initialRequest.id,
        });
        track(ANALYTICS_EVENTS.jobCreated, { job_type: jobType, client_mode: 'new' });
        pushToast({ title: 'Job scheduled', variant: 'success' });
        router.push(`/jobs/${jobId}/complete`);
        router.refresh();
      } catch (error) {
        pushToast({
          title: 'Could not schedule the job',
          description: toUserMessage(
            error,
            'Use “Edit details” to check the address, then try again.',
          ),
          variant: 'error',
        });
      }
    });
  };

  if (mode === 'edit') {
    return (
      <div className="space-y-3">
        <button
          type="button"
          className="flex items-center gap-1 text-[12px] text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-secondary)]"
          onClick={() => setMode('review')}
        >
          <span aria-hidden="true">←</span> Back to request summary
        </button>
        <SoloJobForm
          clients={clients}
          propertiesByClientId={propertiesByClientId}
          initialRequest={initialRequest}
          requestUrl={null}
          initialSelection={null}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">
          Requested by {initialRequest.landlordName || 'the landlord'}
        </p>
        <h2 className="mt-1 text-[18px] font-semibold tracking-[-0.01em] text-[var(--color-text-primary)]">
          {JOB_TYPE_LABELS[jobType]}
        </h2>
        <p className="mt-0.5 text-[13px] text-[var(--color-text-secondary)]">
          Review the details the landlord provided, confirm the date, then accept the job.
        </p>
      </div>

      <div className="rounded-[12px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] px-4 py-1">
        <DetailRow label="Property" value={propertyAddressDisplay} />
        <DetailRow label="Site phone" value={sitePhone} />
        <DetailRow label="Landlord" value={initialRequest.landlordName} />
        <DetailRow label="Landlord contact" value={landlordContact} />
        <DetailRow label="Access notes" value={initialRequest.accessNotes} />
        <DetailRow
          label="Preferred date"
          value={initialRequest.preferredDates ? formatPreferredDate(initialRequest.preferredDates) : ''}
        />
      </div>

      <div>
        <label className="text-[11px] font-medium tracking-[0.5px] text-[var(--color-text-tertiary)]">
          Confirm date and time
        </label>
        <Input
          type="datetime-local"
          value={scheduledFor}
          onChange={(event) => setScheduledFor(event.target.value)}
          className="mt-1.5 rounded-[10px]"
          disabled={isPending}
        />
        <p className="mt-1.5 text-[12px] text-[var(--color-text-secondary)]">
          Confirming schedules the job and emails the landlord to confirm. Open a certificate when you’re ready to start.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row-reverse sm:items-center">
        <Button variant="primary" onClick={handleAccept} disabled={isPending} className="w-full sm:w-auto">
          {isPending ? 'Scheduling…' : 'Accept & schedule'}
        </Button>
        <Button
          variant="ghost"
          onClick={() => setMode('edit')}
          disabled={isPending}
          className="w-full sm:w-auto"
        >
          Edit details
        </Button>
      </div>
    </div>
  );
}
