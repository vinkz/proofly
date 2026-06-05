import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { getJobCompletionState, type JobCompletionChecklistItem } from '@/server/jobs';
import { isUUID } from '@/lib/ids';
import { RenewalSendButton } from './renewal-send-button';

const formatDate = (value: string | null) => {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const STATUS_LABELS: Record<JobCompletionChecklistItem['status'], string> = {
  completed: 'Done',
  required: 'Required',
  ready: 'Ready',
  draft_needed: 'Draft needed',
  not_required: 'Not required',
};

const STATUS_ICONS: Record<JobCompletionChecklistItem['status'], string> = {
  completed: '✓',
  required: '!',
  ready: '○',
  draft_needed: '~',
  not_required: '–',
};

function getStatusBadgeClass(status: JobCompletionChecklistItem['status'], isGwn: boolean): string {
  if (status === 'completed') return 'bg-[var(--color-action-bg)] text-[var(--color-action)]';
  if (status === 'required') {
    return isGwn
      ? 'bg-[var(--color-amber-bg)] text-[var(--color-amber)]'
      : 'bg-[var(--color-red-bg)] text-[var(--color-red)]';
  }
  if (status === 'ready') return 'bg-[var(--color-action-bg)] text-[var(--color-action)]';
  if (status === 'draft_needed') return 'bg-[var(--color-amber-bg)] text-[var(--color-amber)]';
  return 'bg-[var(--color-background-secondary)] text-[var(--color-text-tertiary)]';
}

function getStatusIconClass(status: JobCompletionChecklistItem['status'], isGwn: boolean): string {
  if (status === 'completed') return 'bg-[var(--color-action-bg)] text-[var(--color-action)]';
  if (status === 'required') {
    return isGwn
      ? 'bg-[var(--color-amber-bg)] text-[var(--color-amber)]'
      : 'bg-[var(--color-red-bg)] text-[var(--color-red)]';
  }
  if (status === 'ready') return 'bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)]';
  if (status === 'draft_needed') return 'bg-[var(--color-amber-bg)] text-[var(--color-amber)]';
  return 'bg-[var(--color-background-secondary)] text-[var(--color-text-tertiary)]';
}

function getActionLabel(item: JobCompletionChecklistItem): string {
  if (item.status === 'completed') return 'Open';
  if (item.id === 'gas_warning_notice') return 'Issue warning notice';
  if (item.id === 'invoice') return item.status === 'draft_needed' ? 'Create draft' : 'Review';
  return 'Complete';
}

function getActionClass(item: JobCompletionChecklistItem): string {
  if (item.status === 'completed') {
    return 'border-[0.5px] border-[var(--color-border-secondary)] bg-transparent text-[var(--color-text-secondary)]';
  }
  if (item.id === 'gas_warning_notice' && item.status === 'required') {
    return 'bg-[var(--color-amber-bg)] text-[var(--color-amber)]';
  }
  if (item.id === 'invoice') {
    return 'border-[0.5px] border-[var(--color-border-secondary)] bg-transparent text-[var(--color-text-secondary)]';
  }
  return 'bg-[var(--color-cta)] text-[var(--color-cta-fg)]';
}

function ChecklistRow({ item }: { item: JobCompletionChecklistItem }) {
  const isGwn = item.id === 'gas_warning_notice';
  const completedAt = formatDate(item.completedAt);
  const actionLabel = getActionLabel(item);
  const actionClass = getActionClass(item);
  const iconClass = getStatusIconClass(item.status, isGwn);
  const badgeClass = getStatusBadgeClass(item.status, isGwn);

  return (
    <div className="flex items-start justify-between gap-3 border-t-[0.5px] border-[var(--color-border-tertiary)] py-3.5 sm:items-center">
      <div className="flex min-w-0 gap-3">
        <span
          className={`mt-0.5 inline-flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[8px] text-[13px] font-semibold sm:mt-0 ${iconClass}`}
        >
          {STATUS_ICONS[item.status]}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[14px] font-medium text-[var(--color-text-primary)]">{item.label}</span>
            <span className={`inline-flex items-center rounded-[6px] px-1.5 py-0.5 text-[11px] font-medium ${badgeClass}`}>
              {STATUS_LABELS[item.status]}
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-[var(--color-text-secondary)]">{item.description}</p>
          {completedAt ? (
            <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)]">Stored {completedAt}</p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {item.editHref && item.status === 'completed' ? (
          <Link
            href={item.editHref}
            className="inline-flex h-[34px] items-center justify-center rounded-[10px] border-[0.5px] border-[var(--color-border-secondary)] px-3 text-[12px] font-medium text-[var(--color-text-secondary)] transition-opacity hover:opacity-80"
          >
            Edit
          </Link>
        ) : null}
        {item.href ? (
          <Link
            href={item.href}
            className={`inline-flex h-[34px] items-center justify-center rounded-[10px] px-3 text-[12px] font-medium transition-opacity hover:opacity-80 ${actionClass}`}
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default async function JobCompletionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params;
  if (!isUUID(jobId)) notFound();

  let state: Awaited<ReturnType<typeof getJobCompletionState>>;
  try {
    state = await getJobCompletionState(jobId);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') redirect('/login');
      if (error.message === 'Job not found') notFound();
    }
    throw error;
  }

  const title = state.job.title || state.job.clientName || 'Job completion';
  const status = state.job.status ?? 'draft';

  const statusPillClass =
    status === 'issued'
      ? 'bg-[var(--color-action-bg)] text-[var(--color-action)]'
      : 'bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)]';

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6 sm:py-10">
      <div>
        <Link
          href="/dashboard"
          className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-secondary)]"
        >
          ← Dashboard
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-[var(--color-text-primary)]">
              {title}
            </h1>
            {state.job.address ? (
              <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">{state.job.address}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center rounded-[8px] px-2 py-0.5 text-[11px] font-medium capitalize ${statusPillClass}`}>
              {status}
            </span>
            {state.unsafeApplianceCount ? (
              <span className="inline-flex items-center rounded-[8px] bg-[var(--color-red-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-red)]">
                {state.unsafeApplianceCount} unsafe flag{state.unsafeApplianceCount !== 1 ? 's' : ''}
              </span>
            ) : null}
          </div>
        </div>
        <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">
          Review required documents before sending the handover bundle. Invoice is optional and does not block issuing.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_260px]">
        {/* Checklist */}
        <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-5 pb-4">
          <div className="pb-1 pt-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Required</p>
          </div>
          {state.required.length ? (
            state.required.map((item) => <ChecklistRow key={item.id} item={item} />)
          ) : (
            <p className="border-t-[0.5px] border-[var(--color-border-tertiary)] py-4 text-[13px] text-[var(--color-text-secondary)]">
              No required certificates inferred for this job.
            </p>
          )}
          <div className="pb-1 pt-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Optional</p>
          </div>
          {state.optional.map((item) => <ChecklistRow key={item.id} item={item} />)}
        </div>

        {/* Send readiness panel */}
        <aside className="h-fit rounded-[16px] bg-[#111] p-5 text-white">
          <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-white/50">Send readiness</p>
          <h2 className="mt-3 text-[18px] font-semibold leading-tight">
            {state.canSend ? 'Ready to send' : 'Action needed'}
          </h2>
          {state.canSend ? (
            <p className="mt-2 text-[13px] leading-[1.6] text-white/70">
              All required documents are complete. Send to landlord or tenant.
            </p>
          ) : (
            <div className="mt-2.5 space-y-1.5">
              {state.missingBlockingLabels.map((label) => (
                <div key={label} className="flex items-center gap-2 text-[12px] text-white/60">
                  <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-[var(--color-red)]" aria-hidden="true" />
                  {label}
                </div>
              ))}
            </div>
          )}

          {state.canSend ? (
            <Link
              href={`/jobs/${state.job.id}/deliver`}
              className="mt-5 flex h-[44px] w-full items-center justify-center rounded-[10px] bg-white text-[14px] font-medium text-[#111] transition-opacity hover:opacity-90"
            >
              Send to landlord →
            </Link>
          ) : (
            <div
              className="mt-5 flex h-[44px] w-full cursor-not-allowed items-center justify-center rounded-[10px] bg-white/10 text-[14px] font-medium text-white/25"
              aria-disabled="true"
            >
              Send to landlord →
            </div>
          )}

          <div className="mt-3 flex gap-2 border-t-[0.5px] border-white/10 pt-3">
            <Link
              href={state.pdfHref}
              className="flex-1 text-center text-[12px] text-white/50 transition-colors hover:text-white/70"
            >
              Open certificates
            </Link>
            {state.publicHref ? (
              <Link
                href={state.publicHref}
                className="flex-1 text-center text-[12px] text-white/50 transition-colors hover:text-white/70"
              >
                Public view
              </Link>
            ) : null}
          </div>
        </aside>
      </div>

      {/* Renewal */}
      {state.renewalDue ? (
        <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Renewal</p>
          <p className="mt-1 text-[15px] font-semibold text-[var(--color-text-primary)]">
            Renewal due {formatDate(state.renewalDue) ?? state.renewalDue}
          </p>
          <p className="mt-0.5 text-[13px] text-[var(--color-text-secondary)]">
            We&apos;ll prompt you 8 and 4 weeks before this date. You can send the landlord a renewal request now.
          </p>
          <RenewalSendButton jobId={state.job.id} hasLandlordEmail={state.hasLandlordEmail} />
        </div>
      ) : null}
    </main>
  );
}
