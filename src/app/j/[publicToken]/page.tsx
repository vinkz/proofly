import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Button } from '@/components/ui/button';
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

function labelStatus(value: string | null | undefined) {
  if (!value) return 'To be confirmed';
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function PublicJobPage({
  params,
}: {
  params: Promise<{ publicToken: string }>;
}) {
  const { publicToken } = await params;
  const job = await getPublicJobByToken(publicToken);
  if (!job) notFound();
  const workStatus = job.certificates.length
    ? 'Certificate available'
    : job.jobStatus === 'active'
      ? 'Job in progress'
      : labelStatus(job.jobStatus);
  const invoiceStatus = job.invoice ? labelStatus(job.invoice.status) : 'Not issued yet';
  const paymentStatus = job.invoice?.paymentStatus ? labelStatus(job.invoice.paymentStatus) : null;

  return (
    <div className="min-h-screen bg-[var(--color-background-secondary)]">
      {/* Minimal header */}
      <header className="border-b-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">CertNow</span>
          <span className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Job summary</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="grid gap-6 py-4 lg:grid-cols-[1.25fr,0.75fr] lg:items-end">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Property</p>
            <h1 className="mt-2 max-w-4xl text-[22px] font-semibold leading-tight tracking-[-0.02em] text-[var(--color-text-primary)]">
              {job.address}
            </h1>
            <div className="mt-4 flex flex-wrap gap-2">
              {job.completedWork.map((item) => (
                <span key={item} className="rounded-full border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-3 py-1 text-[13px] font-medium text-[var(--color-text-primary)]">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <aside className="space-y-4 border-t-[0.5px] border-[var(--color-border-tertiary)] pt-4 lg:border-l-[0.5px] lg:border-t-0 lg:pl-6 lg:pt-0">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Job status</p>
              <p className="mt-1.5 text-[20px] font-semibold text-[var(--color-text-primary)]">{workStatus}</p>
              {job.requestStatus ? (
                <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
                  Request: {labelStatus(job.requestType)} / {labelStatus(job.requestStatus)}
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Engineer</p>
              <p className="mt-1.5 text-[17px] font-semibold text-[var(--color-text-primary)]">{job.engineer.name ?? job.engineer.company ?? 'Gas Safe engineer'}</p>
              <div className="mt-1.5 space-y-0.5 text-[13px] text-[var(--color-text-secondary)]">
                {job.engineer.company ? <p>{job.engineer.company}</p> : null}
                {job.engineer.gasSafeNumber ? <p>Gas Safe {job.engineer.gasSafeNumber}</p> : null}
                {job.engineer.phone ? <p>{job.engineer.phone}</p> : null}
                {job.engineer.email ? <p>{job.engineer.email}</p> : null}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Next inspection</p>
              <p className="mt-1.5 text-[20px] font-semibold text-[var(--color-text-primary)]">{job.nextInspectionDue ?? 'To be confirmed'}</p>
            </div>
          </aside>
        </div>

        <section className="grid gap-4 border-t-[0.5px] border-[var(--color-border-tertiary)] py-5 lg:grid-cols-3">
          <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-5">
            <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">Certificates</p>
            <div className="mt-3 space-y-2">
              {job.certificates.length ? (
                job.certificates.map((certificate) => (
                  <div key={certificate.id} className="flex items-center justify-between gap-3 rounded-[12px] bg-[var(--color-background-secondary)] px-3 py-2.5">
                    <div>
                      <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">{certificate.label}</p>
                      <p className="text-[11px] text-[var(--color-text-tertiary)]">{certificate.issuedAt ? `Issued ${certificate.issuedAt.slice(0, 10)}` : 'Issued'}</p>
                    </div>
                    {certificate.downloadUrl ? (
                      <Button asChild variant="secondary" className="rounded-full">
                        <Link href={certificate.downloadUrl}>Download</Link>
                      </Button>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="rounded-[12px] bg-[var(--color-background-secondary)] px-3 py-2.5 text-[13px] text-[var(--color-text-secondary)]">Certificates will appear here when the job is complete.</p>
              )}
            </div>
          </div>

          <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-5">
            <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">Invoice</p>
            <div className="mt-3 rounded-[12px] bg-[var(--color-background-secondary)] px-3 py-2.5">
              <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">{invoiceStatus}</p>
              {job.invoice?.invoiceNumber ? (
                <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">{job.invoice.invoiceNumber}</p>
              ) : null}
              {job.invoice?.dueDate ? (
                <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">Due {job.invoice.dueDate.slice(0, 10)}</p>
              ) : null}
              {paymentStatus ? (
                <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">Payment: {paymentStatus}</p>
              ) : null}
              {job.invoice?.downloadUrl ? (
                <Button asChild variant="secondary" className="mt-3 rounded-full">
                  <Link href={job.invoice.downloadUrl}>Download invoice</Link>
                </Button>
              ) : (
                <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">
                  {job.invoice ? 'Invoice PDF is not available yet.' : 'Your engineer has not shared an invoice yet.'}
                </p>
              )}
              {job.invoice?.paymentLinkUrl ? (
                <Button asChild className="mt-2 rounded-full bg-[var(--color-cta)] text-[var(--color-cta-fg)] hover:opacity-90">
                  <Link href={job.invoice.paymentLinkUrl}>Open payment link</Link>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="space-y-4">
            {job.engineerOwnsJob ? (
              <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-cta)] p-5">
                <p className="text-[13px] font-semibold text-[var(--color-cta-fg)]">Engineer actions</p>
                <div className="mt-4 space-y-2 text-[13px] text-[var(--color-cta-fg)]/75">
                  <p>Status: {job.jobStatus}</p>
                  <p>Certificates: {job.certificates.length}</p>
                  <p>Invoice: {invoiceStatus}</p>
                  <p>Landlord email: {job.landlordEmail ? 'Captured' : 'Missing'}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild className="rounded-full bg-[var(--color-background-primary)] text-[var(--color-text-primary)] hover:opacity-90">
                    <Link href={`/invoices/new?jobId=${job.jobId}`}>Raise invoice</Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-full border-[var(--color-cta-fg)]/25 text-[var(--color-cta-fg)] hover:bg-[var(--color-cta-fg)]/10">
                    <Link href={`/jobs/${job.jobId}/pdf`}>Open job</Link>
                  </Button>
                </div>
              </div>
            ) : !job.landlordEmail ? (
              <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-5">
                <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">Get renewal reminders</p>
                <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
                  Add one email address and we&apos;ll use it to send a reminder before this certificate expires.
                </p>
                <LandlordEmailCapture token={job.token} />
              </div>
            ) : (
              <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-5">
                <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">Reminder email saved</p>
                <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">Your engineer has the landlord contact for renewal reminders.</p>
              </div>
            )}
            {isDueForRenewal(job.nextInspectionDue) ? (
              <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-5">
                <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">Request renewal</p>
                <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
                  Send tenant access details directly to {job.engineer.name ?? job.engineer.company ?? 'your engineer'}.
                </p>
                <RenewalRequestForm token={job.token} />
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
