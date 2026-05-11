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
    <main className="min-h-screen bg-[#f5f2ea] text-slate-950">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <div className="grid gap-8 py-6 lg:grid-cols-[1.25fr,0.75fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">Property</p>
            <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-[0.95] tracking-[-0.04em] text-slate-950 sm:text-6xl lg:text-7xl">
              {job.address}
            </h1>
            <div className="mt-6 flex flex-wrap gap-2">
              {job.completedWork.map((item) => (
                <span key={item} className="rounded-full border border-slate-950/10 bg-white/60 px-3 py-1 text-sm font-medium">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <aside className="space-y-5 border-t border-slate-950/10 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Job status</p>
              <p className="mt-2 text-2xl font-semibold">{workStatus}</p>
              {job.requestStatus ? (
                <p className="mt-1 text-sm text-slate-600">
                  Request: {labelStatus(job.requestType)} / {labelStatus(job.requestStatus)}
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Engineer</p>
              <p className="mt-2 text-xl font-semibold">{job.engineer.name ?? job.engineer.company ?? 'Gas Safe engineer'}</p>
              <div className="mt-2 space-y-1 text-sm text-slate-700">
                {job.engineer.company ? <p>{job.engineer.company}</p> : null}
                {job.engineer.gasSafeNumber ? <p>Gas Safe {job.engineer.gasSafeNumber}</p> : null}
                {job.engineer.phone ? <p>{job.engineer.phone}</p> : null}
                {job.engineer.email ? <p>{job.engineer.email}</p> : null}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Next inspection</p>
              <p className="mt-2 text-2xl font-semibold">{job.nextInspectionDue ?? 'To be confirmed'}</p>
            </div>
          </aside>
        </div>

        <section className="grid gap-4 border-t border-slate-950/10 py-6 lg:grid-cols-3">
          <div className="rounded-3xl bg-white/70 p-5">
            <p className="text-sm font-semibold">Certificates</p>
            <div className="mt-3 space-y-2">
              {job.certificates.length ? (
                job.certificates.map((certificate) => (
                  <div key={certificate.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/65 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold">{certificate.label}</p>
                      <p className="text-xs text-slate-600">{certificate.issuedAt ? `Issued ${certificate.issuedAt.slice(0, 10)}` : 'Issued'}</p>
                    </div>
                    {certificate.downloadUrl ? (
                      <Button asChild variant="secondary" className="rounded-full">
                        <Link href={certificate.downloadUrl}>Download</Link>
                      </Button>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="rounded-2xl bg-white/65 px-4 py-3 text-sm text-slate-600">Certificates will appear here when the job is complete.</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-white/70 p-5">
            <p className="text-sm font-semibold">Invoice</p>
            <div className="mt-3 rounded-2xl bg-white/65 px-4 py-3">
              <p className="text-sm font-semibold">{invoiceStatus}</p>
              {job.invoice?.invoiceNumber ? (
                <p className="mt-1 text-xs text-slate-600">{job.invoice.invoiceNumber}</p>
              ) : null}
              {job.invoice?.dueDate ? (
                <p className="mt-1 text-xs text-slate-600">Due {job.invoice.dueDate.slice(0, 10)}</p>
              ) : null}
              {paymentStatus ? (
                <p className="mt-1 text-xs text-slate-600">Payment: {paymentStatus}</p>
              ) : null}
              {job.invoice?.downloadUrl ? (
                <Button asChild variant="secondary" className="mt-3 rounded-full">
                  <Link href={job.invoice.downloadUrl}>Download invoice</Link>
                </Button>
              ) : (
                <p className="mt-2 text-sm text-slate-600">
                  {job.invoice ? 'Invoice PDF is not available yet.' : 'Your engineer has not shared an invoice yet.'}
                </p>
              )}
              {job.invoice?.paymentLinkUrl ? (
                <Button asChild className="mt-2 rounded-full bg-slate-950 text-white hover:bg-slate-800">
                  <Link href={job.invoice.paymentLinkUrl}>Open payment link</Link>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="space-y-4">
            {job.engineerOwnsJob ? (
              <div className="rounded-3xl bg-slate-950 p-5 text-white">
                <p className="text-sm font-semibold">Engineer actions</p>
                <div className="mt-4 space-y-2 text-sm text-white/75">
                  <p>Status: {job.jobStatus}</p>
                  <p>Certificates: {job.certificates.length}</p>
                  <p>Invoice: {invoiceStatus}</p>
                  <p>Landlord email: {job.landlordEmail ? 'Captured' : 'Missing'}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild className="rounded-full bg-white text-slate-950 hover:bg-white/90">
                    <Link href={`/invoices/new?jobId=${job.jobId}`}>Raise invoice</Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-full border-white/25 text-white hover:bg-white/10">
                    <Link href={`/jobs/${job.jobId}/pdf`}>Open job</Link>
                  </Button>
                </div>
              </div>
            ) : !job.landlordEmail ? (
              <div className="rounded-3xl bg-white/70 p-5">
                <p className="text-sm font-semibold">Get renewal reminders</p>
                <p className="mt-1 text-sm text-slate-600">
                  Add one email address and we’ll use it to send a reminder before this certificate expires.
                </p>
                <LandlordEmailCapture token={job.token} />
              </div>
            ) : (
              <div className="rounded-3xl bg-white/70 p-5">
                <p className="text-sm font-semibold">Reminder email saved</p>
                <p className="mt-1 text-sm text-slate-600">Your engineer has the landlord contact for renewal reminders.</p>
              </div>
            )}
            {isDueForRenewal(job.nextInspectionDue) ? (
              <div className="rounded-3xl bg-white/70 p-5">
                <p className="text-sm font-semibold">Request renewal</p>
                <p className="mt-1 text-sm text-slate-600">
                  Send tenant access details directly to {job.engineer.name ?? job.engineer.company ?? 'your engineer'}.
                </p>
                <RenewalRequestForm token={job.token} />
              </div>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}
