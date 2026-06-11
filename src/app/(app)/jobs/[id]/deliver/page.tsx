import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { isUUID } from '@/lib/ids';
import { buildDeliveryBundle } from '@/server/delivery';
import { getJobCompletionState } from '@/server/jobs';
import { SendPanel } from './send-panel';

const formatDate = (value: string | null) => {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export default async function DeliverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUUID(id)) notFound();

  const state = await getJobCompletionState(id).catch(() => null);
  if (!state) notFound();
  if (!state.canSend) redirect(`/jobs/${id}/complete`);

  const bundle = await buildDeliveryBundle(id).catch(() => null);
  if (!bundle) {
    redirect(`/jobs/${id}/complete`);
  }

  const allItems = [...state.required, ...state.optional];
  const completedCerts = allItems.filter((item) => item.status === 'completed' && item.id !== 'invoice');
  const invoiceItem = state.optional.find((item) => item.id === 'invoice') ?? null;

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-6 sm:py-10">
      {/* Back nav */}
      <Link
        href={`/jobs/${id}/complete`}
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-secondary)]"
      >
        <span aria-hidden="true">←</span> Back to checklist
      </Link>

      {/* Header */}
      <div className="mt-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]">
          Delivery
        </p>
        <h1 className="mt-1 text-[22px] font-semibold text-[var(--color-text-primary)]">
          {state.job.address ?? state.job.clientName ?? 'Send documents'}
        </h1>
      </div>

      <div className="mt-6 space-y-4">
        {/* Certificates */}
        <section className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
          <div className="px-5 pt-4 pb-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]">
              Certificates included
            </p>
          </div>
          <div className="divide-y-[0.5px] divide-[var(--color-border-tertiary)]">
            {bundle.certificates.length ? (
              bundle.certificates.map((cert) => (
                <div key={cert.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">
                      {cert.label}
                    </p>
                    {cert.issuedAt ? (
                      <p className="mt-0.5 text-[12px] text-[var(--color-text-tertiary)]">
                        Issued {formatDate(cert.issuedAt)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {cert.previewUrl ? (
                      <a
                        href={cert.previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-[30px] rounded-[8px] border-[0.5px] border-[var(--color-border-secondary)] px-3 text-[12px] font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] inline-flex items-center"
                      >
                        Preview
                      </a>
                    ) : null}
                    <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[var(--color-action-bg)] text-[11px] font-bold text-[var(--color-action)]">
                      ✓
                    </span>
                  </div>
                </div>
              ))
            ) : (
              completedCerts.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div>
                    <p className="text-[13px] font-medium text-[var(--color-text-primary)]">{item.label}</p>
                  </div>
                  <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[var(--color-action-bg)] text-[11px] font-bold text-[var(--color-action)]">
                    ✓
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Invoice — honest non-blocking */}
        <section className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Invoice</p>
              <p className="mt-0.5 text-[12px] text-[var(--color-text-tertiary)]">
                {bundle.hasInvoice && bundle.invoiceStatus === 'issued'
                  ? 'Issued — not attached to this delivery'
                  : bundle.hasInvoice
                    ? 'Draft — not included yet'
                    : 'Not created — not included'}
              </p>
            </div>
            {invoiceItem?.href ? (
              <Link
                href={invoiceItem.href}
                className="h-[30px] shrink-0 rounded-[8px] border-[0.5px] border-[var(--color-border-secondary)] px-3 text-[12px] font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] inline-flex items-center"
              >
                {bundle.hasInvoice ? 'View' : 'Create'}
              </Link>
            ) : null}
          </div>
        </section>

        {/* Send panel */}
        <SendPanel bundle={bundle} />

        {/* Public link copy */}
        <section className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-5 py-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-eyebrow)]">
            Permanent link
          </p>
          <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
            Accessible without login. Share any time.
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-[8px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3 py-2 text-[12px] text-[var(--color-text-secondary)]">
              {bundle.publicHref}
            </code>
            <a
              href={bundle.publicHref}
              target="_blank"
              rel="noopener noreferrer"
              className="h-[34px] shrink-0 rounded-[8px] border-[0.5px] border-[var(--color-border-secondary)] px-3 text-[12px] font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] inline-flex items-center"
            >
              Open ↗
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
