'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const DISMISS_KEY = 'certnow-dashboard-account-setup-dismissed-v1';

type GetStartedCardProps = {
  profileMissingFields: string[];
  certificateProfileComplete: boolean;
  invoiceMissingFields: string[];
  signatureSaved: boolean;
  hasStandardRate: boolean;
};

export function GetStartedCard({
  profileMissingFields,
  certificateProfileComplete,
  invoiceMissingFields,
  signatureSaved,
  hasStandardRate,
}: GetStartedCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const optionalInvoiceComplete = invoiceMissingFields.length === 0;
  const frictionlessSetupComplete = optionalInvoiceComplete && signatureSaved && hasStandardRate;
  const allPrereqsDone = certificateProfileComplete && frictionlessSetupComplete;
  const canDismiss = allPrereqsDone;
  const primaryHref = certificateProfileComplete ? '/jobs/new' : '/settings';
  const primaryLabel = certificateProfileComplete ? 'Create first certificate' : 'Complete profile';
  const invoiceDetailsMissing = invoiceMissingFields.some((field) => field !== 'CP12 standard rate');
  const frictionlessMissingItems = [
    invoiceDetailsMissing ? 'invoice details' : null,
    !signatureSaved ? 'saved signature' : null,
    !hasStandardRate ? 'standard rates' : null,
  ].filter((item): item is string => item !== null);

  useEffect(() => {
    if (!canDismiss) {
      setDismissed(false);
      return;
    }
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === '1');
  }, [canDismiss]);

  if (canDismiss && dismissed) return null;

  return (
    <div className="overflow-hidden rounded-[18px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
      <div className="px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">
              Get started with CertNow
            </p>
            <h3 className="mt-1 text-[19px] font-medium tracking-[-0.01em] text-[var(--color-text-primary)]">
              Create first certificate
            </h3>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="rounded-[10px] bg-[var(--color-action-bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-action)]">
              Approx. 2 mins
            </span>
            {canDismiss ? (
              <button
                type="button"
                onClick={() => {
                  window.localStorage.setItem(DISMISS_KEY, '1');
                  setDismissed(true);
                }}
                className="inline-flex h-7 items-center justify-center rounded-[14px] border-[0.5px] border-[var(--color-border-secondary)] px-2.5 text-[11px] font-medium text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
              >
                Dismiss
              </button>
            ) : null}
          </div>
        </div>
        <p className="mt-2 text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
          Complete the essentials, add time-saving defaults, then issue your first certificate.
        </p>
      </div>

      <div className="divide-y-[0.5px] divide-[var(--color-border-tertiary)] border-t-[0.5px] border-[var(--color-border-tertiary)]">
        <ChecklistStepLink
          stepNumber={1}
          done={certificateProfileComplete}
          label="Certificate-ready profile"
          detail={
            certificateProfileComplete
              ? 'Gas Safe and company details ready.'
              : profileMissingFields.length > 0
                ? `${profileMissingFields.slice(0, 2).join(', ')}${profileMissingFields.length > 2 ? ` +${profileMissingFields.length - 2} more` : ''}`
                : 'Gas Safe number, licence class, and company details.'
          }
          statusLabel={certificateProfileComplete ? 'Done' : 'Required'}
          statusTone={certificateProfileComplete ? 'done' : 'required'}
          href="/settings"
        />
        <ChecklistStepLink
          stepNumber={2}
          done={frictionlessSetupComplete}
          label="Make every job frictionless"
          detail={
            frictionlessSetupComplete
              ? 'Invoice details, saved signature and standard rates ready.'
              : `Add ${frictionlessMissingItems.join(', ')} to save time on every job.`
          }
          statusLabel={frictionlessSetupComplete ? 'Done' : 'Optional'}
          statusTone={frictionlessSetupComplete ? 'done' : 'optional'}
          href="/settings"
        />
        <div className={`flex items-center gap-3 px-5 py-3.5 ${!certificateProfileComplete ? 'opacity-40' : ''}`}>
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-[12px] font-medium ${certificateProfileComplete ? 'bg-[var(--color-cta)] text-[var(--color-cta-fg)]' : 'bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)]'}`}>
            3
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-[var(--color-text-primary)]">Create first certificate</p>
            <p className="mt-0.5 text-[12px] text-[var(--color-text-secondary)]">Open the job flow and choose a certificate type.</p>
          </div>
          <Link
            href={primaryHref}
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-[18px] bg-[var(--color-cta)] px-3.5 text-[13px] font-medium text-[var(--color-cta-fg)]"
            tabIndex={certificateProfileComplete ? undefined : -1}
            aria-disabled={!certificateProfileComplete}
          >
            {primaryLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ChecklistStepLink({
  stepNumber,
  done,
  label,
  detail,
  statusLabel,
  statusTone,
  href,
}: {
  stepNumber: number;
  done: boolean;
  label: string;
  detail: string;
  statusLabel: string;
  statusTone: 'done' | 'required' | 'optional';
  href: string;
}) {
  const statusClass =
    statusTone === 'done'
      ? 'bg-[var(--color-action-bg)] text-[var(--color-action)]'
      : statusTone === 'required'
        ? 'bg-[var(--color-red-bg)] text-[var(--color-red)]'
        : 'bg-[var(--color-background-secondary)] text-[var(--color-text-tertiary)]';

  return (
    <Link href={href} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--color-background-secondary)]">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] ${done ? 'bg-[var(--color-action-bg)] text-[var(--color-action)]' : 'bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)]'}`}>
        {done ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2.5 7.5L5.5 10.5L11.5 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <span className="text-[12px] font-medium">{stepNumber}</span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-[var(--color-text-primary)]">{label}</p>
        <p className="mt-0.5 line-clamp-1 text-[12px] text-[var(--color-text-secondary)]">{detail}</p>
      </div>
      <span className={`shrink-0 rounded-[8px] px-2 py-0.5 text-[11px] font-medium ${statusClass}`}>
        {statusLabel}
      </span>
    </Link>
  );
}
