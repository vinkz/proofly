import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PublicComplianceStatusRow } from '@/components/public-compliance-status';
import { formatPublicDisplayDate, getPublicComplianceInfo } from '@/lib/public-compliance';
import { getPublicJobByToken } from '@/server/public-job';
import { LandlordEmailCapture } from './landlord-email-capture';
import { RenewalRequestForm } from './renewal-request-form';

function isDueForRenewal(dateString: string | null) {
  if (!dateString) return false;
  const due = new Date(`${dateString.slice(0, 10)}T00:00:00Z`).getTime();
  if (Number.isNaN(due)) return false;
  const today = new Date();
  const todayStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return due - todayStart <= 60 * 24 * 60 * 60 * 1000;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return (words[0][0] ?? '?').toUpperCase();
  return ((words[0][0] ?? '') + (words[words.length - 1][0] ?? '')).toUpperCase();
}

function isWarningCert(label: string): boolean {
  return /warning|notice/i.test(label);
}

export default async function PublicJobPage({
  params,
}: {
  params: Promise<{ publicToken: string }>;
}) {
  const { publicToken } = await params;
  const job = await getPublicJobByToken(publicToken);
  if (!job) notFound();

  const engineerName = job.engineer.name ?? job.engineer.company ?? 'Your engineer';
  const engineerInitials = getInitials(job.engineer.name ?? job.engineer.company);
  // A landlord viewing their own property record can always confirm/book a renewal date — the card's
  // copy adapts to how close the certificate is to expiry. Previously this was gated on the 60-day
  // renewal window, which hid the action for freshly-issued certs and left landlords with no way to
  // book the next visit.
  const showRenewal = !job.engineerOwnsJob;
  const renewalDueSoon = Boolean(job.renewalRequestedAt) || isDueForRenewal(job.nextInspectionDue);
  const showEmailCapture = !job.engineerOwnsJob && !job.landlordEmail && !showRenewal;
  const compliance = getPublicComplianceInfo(job.nextInspectionDue, job.certificates.length > 0);

  return (
    <div className="min-h-screen bg-[var(--color-background-secondary)]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
        <div className="mx-auto flex h-12 max-w-xl items-center justify-between px-4">
          <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">CertNow</span>
          <span className="rounded-full border-[0.5px] border-[var(--color-border-secondary)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-tertiary)]">
            Property record
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-3 px-4 py-5">
        {/* Card 1 — Property */}
        <div className="overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
          <div className="p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]">
              Property
            </p>
            <h1 className="mt-1 text-[18px] font-medium leading-snug text-[var(--color-text-primary)]">
              {job.address}
            </h1>
            {job.completedWork.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {job.completedWork.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border-[0.5px] border-[var(--color-border-secondary)] px-2.5 py-0.5 text-[12px] font-medium text-[var(--color-text-secondary)]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <PublicComplianceStatusRow
            compliance={compliance}
            className="border-t-[0.5px] border-[var(--color-border-tertiary)] px-4 py-3"
          />
        </div>

        {/* Card 2 — Engineer */}
        <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[#edf7f2] text-[13px] font-medium text-[#1a7a52]">
              {engineerInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-[var(--color-text-primary)]">{engineerName}</p>
              {job.engineer.company && job.engineer.name ? (
                <p className="mt-0.5 text-[12px] text-[var(--color-text-secondary)]">{job.engineer.company}</p>
              ) : null}
              {job.engineer.gasSafeNumber ? (
                <p className="mt-0.5 text-[12px] text-[var(--color-text-tertiary)]">
                  Gas Safe {job.engineer.gasSafeNumber}
                </p>
              ) : null}
            </div>
            {job.engineer.phone ? (
              <a
                href={`tel:${job.engineer.phone}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[0.5px] border-[var(--color-border-secondary)] text-[var(--color-text-secondary)]"
                aria-label="Call engineer"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6.07 6.07l.9-.9a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </a>
            ) : null}
          </div>
        </div>

        {/* Card 3 — Certificates */}
        {job.certificates.length > 0 ? (
          <div className="overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
            <p className="px-4 py-3.5 text-[14px] font-medium text-[var(--color-text-primary)]">Certificates</p>
            {job.certificates.map((cert) => (
              <div
                key={cert.id}
                className="flex items-center justify-between gap-3 border-t-[0.5px] border-[var(--color-border-tertiary)] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-[var(--color-text-primary)]">{cert.label}</p>
                  <p className="mt-0.5 text-[12px] text-[var(--color-text-tertiary)]">
                    Issued{' '}
                    {cert.issuedAt
                      ? (formatPublicDisplayDate(cert.issuedAt) ?? cert.issuedAt.slice(0, 10))
                      : 'date not recorded'}
                  </p>
                </div>
                {cert.downloadUrl ? (
                  <a
                    href={cert.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-full bg-[#edf7f2] px-3 py-1 text-[12px] font-medium text-[#1a7a52]"
                  >
                    Download
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {/* Card 4 — Service history */}
        {job.certificates.length > 0 ? (
          <div className="overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
            <p className="px-4 py-3.5 text-[14px] font-medium text-[var(--color-text-primary)]">Service history</p>
            {job.certificates.map((cert) => (
              <div
                key={cert.id}
                className="flex items-center gap-3 border-t-[0.5px] border-[var(--color-border-tertiary)] px-4 py-3"
              >
                <div
                  className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full ${
                    isWarningCert(cert.label) ? 'bg-[#fcebeb]' : 'bg-[var(--color-background-secondary)]'
                  }`}
                >
                  {isWarningCert(cert.label) ? (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#a32d2d"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  ) : (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--color-text-tertiary)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-[var(--color-text-primary)]">{cert.label}</p>
                  <p className="mt-0.5 text-[12px] text-[var(--color-text-tertiary)]">
                    {cert.issuedAt
                      ? (formatPublicDisplayDate(cert.issuedAt) ?? cert.issuedAt.slice(0, 10))
                      : 'Date not recorded'}
                    {engineerName !== 'Your engineer' ? ` · ${engineerName}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Invoice download — only shown when PDF exists, non-engineer view */}
        {!job.engineerOwnsJob && job.invoice?.downloadUrl ? (
          <div className="overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-[14px] font-medium text-[var(--color-text-primary)]">Invoice</p>
                {job.invoice.invoiceNumber ? (
                  <p className="mt-0.5 text-[12px] text-[var(--color-text-tertiary)]">
                    {job.invoice.invoiceNumber}
                  </p>
                ) : null}
              </div>
              <a
                href={job.invoice.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-full bg-[#edf7f2] px-3 py-1 text-[12px] font-medium text-[#1a7a52]"
              >
                Download
              </a>
            </div>
            {job.invoice.paymentLinkUrl ? (
              <div className="border-t-[0.5px] border-[var(--color-border-tertiary)] px-4 py-3">
                <a
                  href={job.invoice.paymentLinkUrl}
                  className="block w-full rounded-[24px] bg-[#111] px-5 py-[13px] text-center text-[15px] font-medium text-white"
                >
                  Open payment link →
                </a>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Renewal request card */}
        {showRenewal ? (
          <div className="overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
            <div className="p-4">
              <p className="text-[15px] font-medium text-[var(--color-text-primary)]">
                {job.propertyToken
                  ? 'Book your next service'
                  : job.certificates.length === 0
                    ? 'Request gas safety check'
                    : renewalDueSoon
                      ? 'Confirm your renewal date'
                      : 'Book your next renewal'}
              </p>
              <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
                {job.propertyToken
                  ? `Open your property record to book your next visit with ${engineerName} and see all your certificates in one place.`
                  : job.certificates.length === 0
                    ? `Send your access details to ${engineerName} to arrange the visit.`
                    : renewalDueSoon
                      ? `Pick a date that works and ${engineerName} will book the renewal visit.`
                      : `Pick a date that works and ${engineerName} will book your next visit.`}
              </p>
            </div>
            <div className="border-t-[0.5px] border-[var(--color-border-tertiary)] p-4">
              {/* Booking is consolidated on the property vault (/p) so there's a single source of
                  truth for the renewal/booked state. /j only hosts its own form when this job has
                  no property record yet (rare — pre-promotion). */}
              {job.propertyToken ? (
                <Link
                  href={`/p/${job.propertyToken}`}
                  className="block w-full rounded-[24px] bg-[#111] px-5 py-[13px] text-center text-[15px] font-medium text-white"
                >
                  Book your next service →
                </Link>
              ) : (
                <RenewalRequestForm
                  token={job.token}
                  defaultDate={job.nextInspectionDue ?? ''}
                  confirmMode={job.certificates.length > 0}
                />
              )}
            </div>
            <p className="px-4 pb-4 text-center text-[12px] text-[var(--color-text-tertiary)]">
              {job.propertyToken
                ? 'Manage and book everything for this property in one place.'
                : 'No account needed. Your details go directly to your engineer.'}
            </p>
          </div>
        ) : null}

        {/* Email capture */}
        {showEmailCapture ? (
          <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4">
            <p className="text-[14px] font-medium text-[var(--color-text-primary)]">Get renewal reminders</p>
            <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
              We&apos;ll remind you before the next inspection is due.
            </p>
            <div className="mt-3">
              <LandlordEmailCapture token={job.token} />
            </div>
          </div>
        ) : null}

        {/* Engineer shortcuts — rendered only for the authenticated engineer who owns the job. */}
        {job.engineerOwnsJob ? (
          <div className="rounded-[16px] border-[0.5px] border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4">
            <p className="text-[12px] font-medium text-[var(--color-text-tertiary)]">Engineer view</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/invoices/new?jobId=${job.jobId}`}
                className="inline-flex h-8 items-center justify-center rounded-full bg-[#edf7f2] px-3 text-[12px] font-medium text-[#1a7a52]"
              >
                Raise invoice
              </Link>
              <Link
                href={`/jobs/${job.jobId}/pdf`}
                className="inline-flex h-8 items-center justify-center rounded-full border-[0.5px] border-[var(--color-border-secondary)] bg-transparent px-3 text-[12px] font-medium text-[var(--color-text-secondary)]"
              >
                Open job
              </Link>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
