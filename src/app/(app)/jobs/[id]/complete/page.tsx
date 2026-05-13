import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getJobCompletionState, type JobCompletionChecklistItem } from '@/server/jobs';
import { isUUID } from '@/lib/ids';

const formatDate = (value: string | null) => {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const statusLabel: Record<JobCompletionChecklistItem['status'], string> = {
  completed: 'Complete',
  required: 'Required',
  ready: 'Ready',
  draft_needed: 'Draft needed',
  not_required: 'Not required',
};

const statusBadgeVariant = (status: JobCompletionChecklistItem['status']) => {
  if (status === 'completed') return 'brand';
  if (status === 'required') return 'accent';
  return 'outline';
};

function ChecklistRow({ item }: { item: JobCompletionChecklistItem }) {
  const icon = item.status === 'completed' ? '✓' : item.status === 'required' ? '!' : item.id === 'invoice' ? '£' : '…';
  const actionLabel =
    item.status === 'completed'
      ? 'Open'
      : item.id === 'invoice'
        ? item.status === 'draft_needed'
          ? 'Create draft'
          : 'Review'
        : 'Complete';
  const completedAt = formatDate(item.completedAt);

  return (
    <div className="grid gap-4 border-t border-slate-200 px-0 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="flex min-w-0 gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white">
          <span aria-hidden="true" className="text-sm font-semibold">
            {icon}
          </span>
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-950">{item.label}</h2>
            <Badge variant={statusBadgeVariant(item.status)}>{statusLabel[item.status]}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600">{item.description}</p>
          {completedAt ? <p className="mt-1 text-xs text-slate-500">Stored {completedAt}</p> : null}
        </div>
      </div>
      {item.href ? (
        <Button asChild variant={item.status === 'required' ? 'primary' : 'outline'} className="rounded-full">
          <Link href={item.href}>{actionLabel}</Link>
        </Button>
      ) : null}
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

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/dashboard" className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
            Back to dashboard
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{status}</Badge>
            {state.unsafeApplianceCount ? <Badge variant="accent">{state.unsafeApplianceCount} unsafe flag(s)</Badge> : null}
          </div>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-normal text-slate-950">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Review the required job outputs before sending the handover bundle. Invoice setup is optional and does not block certificate issue.
          </p>
          {state.job.address ? <p className="mt-2 text-sm text-slate-500">{state.job.address}</p> : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline" className="rounded-full">
            <Link href={state.pdfHref}>
              Open certificates
            </Link>
          </Button>
          {state.publicHref ? (
            <Button asChild variant="outline" className="rounded-full">
              <Link href={state.publicHref}>Public view</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 rounded-lg border border-slate-200 bg-white px-5 shadow-sm">
          <div className="py-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Required</p>
            <p className="mt-1 text-sm text-slate-600">Missing required certificates or notices block sending.</p>
          </div>
          {state.required.length ? (
            state.required.map((item) => <ChecklistRow key={item.id} item={item} />)
          ) : (
            <div className="border-t border-slate-200 py-6 text-sm text-slate-600">
              No required certificate rows were inferred for this legacy job.
            </div>
          )}
          <div className="py-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Optional</p>
            {state.optional.map((item) => <ChecklistRow key={item.id} item={item} />)}
          </div>
        </div>

        <aside className="h-fit rounded-lg border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Send readiness</p>
          <h2 className="mt-3 text-xl font-semibold">{state.canSend ? 'Ready for delivery' : 'Action needed'}</h2>
          {state.canSend ? (
            <p className="mt-2 text-sm text-white/70">
              Required documents are complete. The dedicated delivery screen is the next phase; for now, use the certificate preview.
            </p>
          ) : (
            <div className="mt-3 space-y-2 text-sm text-white/70">
              {state.missingBlockingLabels.map((label) => (
                <p key={label}>Missing: {label}</p>
              ))}
            </div>
          )}
          <Button asChild disabled={!state.canSend} className="mt-5 w-full rounded-full">
            <Link href={state.pdfHref}>
              Review certificate PDF
            </Link>
          </Button>
          <p className="mt-3 text-xs text-white/45">
            Handover delivery with invoice PDF attachment belongs to the next phase.
          </p>
        </aside>
      </section>
    </main>
  );
}
