import Link from 'next/link';
import Image from 'next/image';
import { notFound, redirect } from 'next/navigation';

import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { getJobWithChecklist, markJobComplete } from '@/server/jobs';
import type { JobDetailPayload } from '@/types/job-detail';
import { ChecklistItemCard } from '@/components/checklist-item-card';
import { SignatureModal } from '@/components/signature-modal';
import { GenerateReportButton } from '@/components/report/generate-report-button';
import { ShareReportLinkButton } from '@/components/report/share-link-button';
import { JobProgressProvider } from '@/components/job-progress-context';
import { JobProgressBar } from '@/components/job-progress-bar';
import { DeleteJobButton } from '@/components/jobs/delete-job-button';
import { GenerateJobSheetButton } from '@/components/jobs/generate-job-sheet-button';
import { Button } from '@/components/ui/button';
import { JobInvoicesCard } from '@/components/invoices/job-invoices-card';
import type { Database } from '@/lib/database.types';
import { isUUID } from '@/lib/ids';
import { reportKindForJobType, type ReportKind } from '@/types/reports';
import { CERTIFICATE_LABELS, type CertificateType } from '@/types/certificates';
import { listInvoicesForJob } from '@/server/invoices';

type ChecklistResult = Database['public']['Tables']['job_items']['Row']['result'];
type InvoiceSummary = {
  id: string;
  invoice_number: string;
  status: string;
  vat_rate: string | number | null;
};
type RelatedCertificate = Pick<
  Database['public']['Tables']['certificates']['Row'],
  'id' | 'cert_type' | 'status' | 'created_at' | 'issued_at'
>;

const formatDateTime = (value: string | null | undefined, fallback: string) =>
  value ? new Date(value).toLocaleString() : fallback;

const formatLabel = (value: string | null | undefined, fallback: string) =>
  value
    ? value
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    : fallback;

const certificateLabelFor = (value: string | null | undefined) =>
  value && value in CERTIFICATE_LABELS ? CERTIFICATE_LABELS[value as CertificateType] : null;

const certificateLabelForReportKind = (value: ReportKind | null | undefined) => {
  switch (value) {
    case 'cp12':
      return CERTIFICATE_LABELS.cp12;
    case 'boiler_service':
      return CERTIFICATE_LABELS.gas_service;
    case 'warning_notice':
      return CERTIFICATE_LABELS.gas_warning_notice;
    case 'general_works':
      return CERTIFICATE_LABELS.general_works;
    case 'breakdown':
      return CERTIFICATE_LABELS.breakdown;
    case 'commissioning':
      return CERTIFICATE_LABELS.commissioning;
    case 'job_sheet':
      return 'Job sheet';
    default:
      return null;
  }
};

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ resume?: string }>;
}) {
  const { id: jobId } = await params;
  const resolvedSearch = await searchParams;
  const resumeParam = typeof resolvedSearch?.resume === 'string' ? resolvedSearch.resume : null;
  const showResume = resumeParam === '1' || resumeParam === 'true';
  if (!isUUID(jobId)) {
    notFound();
  }
  let data: JobDetailPayload;
  const supabase = await supabaseServerReadOnly();

  try {
    data = await getJobWithChecklist(jobId);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        redirect('/login');
      }
      if (error.message === 'Job not found') {
        notFound();
      }
    }
    throw error;
  }

  const { job, items, photos, signatures, report } = data;
  const clientName = job.client_name ?? 'Client';
  const jobAddress = job.address ?? 'No address provided';
  const jobStatus = job.status ?? 'pending';
  const createdLabel = formatDateTime(job.created_at, 'Unknown');
  const reportKind = reportKindForJobType(job.job_type ?? null);
  const clientHref = job.client_id ? `/clients/${job.client_id}` : null;
  const propertyHref =
    job.address && job.address.trim().length
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`
      : null;
  const certificateActions = [
    { type: 'cp12', label: 'Start CP12', variant: 'primary' },
    { type: 'gas_service', label: 'Start Gas Service', variant: 'secondary' },
    { type: 'general_works', label: 'Start General Works', variant: 'secondary' },
    { type: 'breakdown', label: 'Gas Breakdown Record', variant: 'secondary' },
    { type: 'commissioning', label: 'Installation/Commissioning Checklist', variant: 'secondary' },
  ] satisfies Array<{ type: CertificateType; label: string; variant: 'primary' | 'secondary' }>;

  const photosWithUrls = await Promise.all(
    photos.map(async (photo) => {
      const { data: signed } = await supabase.storage.from('photos').createSignedUrl(photo.storage_path, 60 * 60);
      return {
        id: photo.id,
        checklist_id: photo.checklist_id,
        storage_path: photo.storage_path,
        signedUrl: signed?.signedUrl ?? null,
      };
    }),
  );

  const photosByChecklist = photosWithUrls.reduce<
    Record<string, { id: string; signedUrl: string | null; storage_path: string }[]>
  >((acc, photo) => {
    const key = photo.checklist_id ?? 'general';
    acc[key] = acc[key] ? [...acc[key], photo] : [photo];
    return acc;
  }, {});

  const plumberSignatureUrl = signatures?.plumber_sig_path
    ? (await supabase.storage.from('signatures').createSignedUrl(signatures.plumber_sig_path, 60 * 60)).data?.signedUrl ?? null
    : null;
  const clientSignatureUrl = signatures?.client_sig_path
    ? (await supabase.storage.from('signatures').createSignedUrl(signatures.client_sig_path, 60 * 60)).data?.signedUrl ?? null
    : null;

  const signaturePreviews: { signer: 'plumber' | 'client'; signedUrl: string | null }[] = [
    { signer: 'plumber', signedUrl: plumberSignatureUrl },
    { signer: 'client', signedUrl: clientSignatureUrl },
  ];

  let reportSignedUrl: string | null = null;
  if (report?.storage_path) {
    const { data: signed } = await supabase.storage.from('reports').createSignedUrl(report.storage_path, 600);
    reportSignedUrl = signed?.signedUrl ?? null;
  }

  const { data: certificatesData, error: certificatesErr } = await supabase
    .from('certificates')
    .select('id, cert_type, status, created_at, issued_at')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });
  if (certificatesErr) throw new Error(certificatesErr.message);

  const relatedCertificates = (certificatesData ?? []) as RelatedCertificate[];
  const primaryCertificateLabel =
    certificateLabelFor(relatedCertificates[0]?.cert_type) ?? certificateLabelForReportKind(reportKind);
  const jobTitle = job.title?.trim() || primaryCertificateLabel || 'Untitled job';
  const generalPhotos = photosByChecklist.general ?? [];

  const invoices = await listInvoicesForJob(jobId);
  const invoiceIds = invoices.map((invoice) => invoice.id);
  const invoiceTotals = new Map<string, number>();
  if (invoiceIds.length) {
    type UntypedQuery = {
      select: (columns?: string) => UntypedQuery;
      eq: (column: string, value: unknown) => UntypedQuery;
      in: (column: string, values: unknown[]) => UntypedQuery;
    };
    type UntypedSupabase = { from: (table: string) => UntypedQuery };
    const untyped = supabase as unknown as UntypedSupabase;
    type InvoiceLineItem = { invoice_id: string | null; quantity: number | string | null; unit_price: number | string | null; vat_exempt: boolean | null };
    const { data: items, error: itemsErr } = await (untyped
      .from('invoice_line_items')
      .select('invoice_id, quantity, unit_price, vat_exempt')
      .in('invoice_id', invoiceIds) as unknown as Promise<{ data: InvoiceLineItem[] | null; error: { message: string } | null }>);
    if (itemsErr) throw itemsErr;
    const grouped = (items ?? []).reduce<Record<string, Array<{ quantity: number; unit_price: number; vat_exempt: boolean }>>>(
      (acc, item) => {
        const key = item.invoice_id ?? '';
        if (!key) return acc;
        const quantity = Number(item.quantity ?? 0);
        const unitPrice = Number(item.unit_price ?? 0);
        const vatExempt = Boolean(item.vat_exempt);
        acc[key] = acc[key]
          ? [...acc[key], { quantity, unit_price: unitPrice, vat_exempt: vatExempt }]
          : [{ quantity, unit_price: unitPrice, vat_exempt: vatExempt }];
        return acc;
      },
      {},
    );
    invoices.forEach((invoice) => {
      const vatRate = Number((invoice as unknown as InvoiceSummary).vat_rate ?? 0);
      const rows = grouped[invoice.id] ?? [];
      const subtotal = rows.reduce((sum, row) => sum + row.quantity * row.unit_price, 0);
      const taxable = rows.reduce((sum, row) => sum + (row.vat_exempt ? 0 : row.quantity * row.unit_price), 0);
      const total = subtotal + taxable * vatRate;
      invoiceTotals.set(invoice.id, total);
    });
  }

  const invoiceSummaries = invoices.map((invoice) => ({
    id: invoice.id,
    invoice_number: invoice.invoice_number,
    status: invoice.status,
    total: invoiceTotals.get(invoice.id) ?? 0,
  }));

  const initialStatuses = Object.fromEntries(
    items.map((item) => [item.id, (item.result ?? 'pending') as ChecklistResult]),
  );

  const handleMarkComplete = async () => {
    'use server';
    await markJobComplete(jobId);
  };

  return (
    <JobProgressProvider initialStatuses={initialStatuses}>
      <main className="mx-auto max-w-5xl p-6">
        <JobProgressBar total={items.length} />
        <div className="flex flex-col gap-2 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-wide">
              <Link href="/jobs" className="text-accent">
                ← Back to jobs
              </Link>
              {clientHref ? (
                <Link href={clientHref} className="text-muted-foreground/60 hover:text-muted">
                  View client
                </Link>
              ) : null}
            </div>
            <p className="mt-2 text-xs uppercase tracking-wide text-accent">Job</p>
            <h1 className="text-2xl font-semibold text-muted">{jobTitle}</h1>
            <p className="text-sm text-muted-foreground/70">{primaryCertificateLabel}</p>
            <p className="text-xs text-muted-foreground/50">Opened {createdLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                jobStatus === 'completed' ? 'bg-brand/20 text-brand' : 'bg-accent/10 text-accent'
              }`}
            >
              {formatLabel(jobStatus, 'Pending')}
            </span>
            <SignatureModal jobId={jobId} signatures={signaturePreviews} />
            <GenerateJobSheetButton jobId={jobId} />
            <GenerateReportButton jobId={jobId} reportKind={reportKind} />
            {reportSignedUrl ? (
              <Link
                href={reportSignedUrl}
                target="_blank"
                className="rounded-2xl border border-white/15 px-4 py-2 text-sm text-muted-foreground transition hover:bg-white/10 hover:text-muted"
              >
                View report
              </Link>
            ) : null}
            {report?.storage_path ? <ShareReportLinkButton jobId={jobId} /> : null}
            <DeleteJobButton jobId={jobId} />
          </div>
        </div>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">Status</p>
            <p className="mt-2 text-sm font-semibold text-muted">{formatLabel(jobStatus, 'Pending')}</p>
            <p className="mt-1 text-xs text-muted-foreground/70">{primaryCertificateLabel}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">Client</p>
            {clientHref ? (
              <Link href={clientHref} className="mt-2 block text-sm font-semibold text-muted hover:text-accent">
                {clientName}
              </Link>
            ) : (
              <p className="mt-2 text-sm font-semibold text-muted">{clientName}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground/70">Related client record</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">Property</p>
            {propertyHref ? (
              <Link
                href={propertyHref}
                target="_blank"
                className="mt-2 block text-sm font-semibold text-muted hover:text-accent"
              >
                {jobAddress}
              </Link>
            ) : (
              <p className="mt-2 text-sm font-semibold text-muted">{jobAddress}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground/70">Site address</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">Schedule</p>
            <p className="mt-2 text-sm font-semibold text-muted">
              {formatDateTime(job.scheduled_for, 'Not scheduled')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              {job.completed_at ? `Completed ${formatDateTime(job.completed_at, 'Unknown')}` : 'Open job record'}
            </p>
          </div>
        </section>

        {showResume ? (
          <section className="mt-6 rounded-2xl border border-[var(--accent)]/40 bg-white/80 p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">Continue visit</p>
                <p className="text-base font-semibold text-muted">Pick up where you left off</p>
                <p className="text-xs text-muted-foreground/70">
                  Resume the visit with the most common actions.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild variant="secondary">
                  <Link href="#certificate-checks">Add photos</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href={`/jobs/new/${jobId}/details`}>Add note</Link>
                </Button>
                <Button asChild variant="primary">
                  <Link href="#certificates">Generate output</Link>
                </Button>
                {job.status && job.status !== 'completed' ? (
                  <form action={handleMarkComplete}>
                    <Button type="submit" variant="outline">
                      Mark job complete
                    </Button>
                  </form>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {job.notes ? (
          <section id="notes" className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Notes</h2>
            <p className="mt-2 text-sm text-muted-foreground/80">{job.notes}</p>
          </section>
        ) : null}

        <section id="certificates" className="mt-8 space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-muted">Related certificates</h2>
            <p className="text-sm text-muted-foreground/70">View the certificate record for this job or start a new one.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            {relatedCertificates.length ? (
              <div className="space-y-3">
                {relatedCertificates.map((certificate) => (
                  <div
                    key={certificate.id}
                    className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/70 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-muted">
                        {certificateLabelFor(certificate.cert_type) ?? formatLabel(certificate.cert_type, 'Certificate')}
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        {certificate.issued_at
                          ? `Issued ${formatDateTime(certificate.issued_at, 'Unknown')}`
                          : `Created ${formatDateTime(certificate.created_at, 'Unknown')}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-xs uppercase text-muted-foreground/70">
                        {formatLabel(certificate.status, 'Ready')}
                      </p>
                      <Button asChild variant="outline" className="rounded-full">
                        <Link href={`/jobs/${job.id}/pdf`}>Open</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/80">No certificates recorded for this job yet.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {certificateActions.map((action) => (
              <Button key={action.type} asChild variant={action.variant} className="rounded-full">
                <Link href={`/wizard/create/${action.type}?jobId=${job.id}`}>{action.label}</Link>
              </Button>
            ))}
          </div>
        </section>

        <JobInvoicesCard jobId={jobId} invoices={invoiceSummaries} />

        <section id="certificate-checks" className="mt-8 space-y-4">
          <h2 className="text-lg font-semibold text-muted">Job checklist</h2>
          {items.length ? (
            <div className="grid gap-4">
              {items.map((item, index) => (
                <ChecklistItemCard
                  key={item.id}
                  jobId={jobId}
                  item={item}
                  photos={photosByChecklist[item.id] ?? []}
                  nextItemId={items[index + 1]?.id ?? null}
                />
              ))}
            </div>
          ) : (
            <p className="rounded border border-dashed border-white/15 p-4 text-sm text-muted-foreground/70">
              Checks have not been recorded for this certificate.
            </p>
          )}
        </section>

        {generalPhotos.length ? (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-muted">General Photos</h2>
            <div className="mt-3 flex flex-wrap gap-3">
              {generalPhotos.map((photo) =>
                photo.signedUrl ? (
                  <Image
                    key={photo.id}
                    src={photo.signedUrl}
                    alt="Job photo"
                    width={96}
                    height={96}
                    unoptimized
                    className="h-24 w-24 rounded border border-white/15 object-cover"
                  />
                ) : null,
              )}
            </div>
          </section>
        ) : null}
      </main>
    </JobProgressProvider>
  );
}
