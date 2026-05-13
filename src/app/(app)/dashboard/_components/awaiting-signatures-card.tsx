'use client';

import Link from 'next/link';

import { useToast } from '@/components/ui/use-toast';

export type AwaitingSignatureJobCard = {
  id: string;
  client_name: string;
  title?: string | null;
  address: string;
  created_at: string;
  shareLink: string | null;
  expiresAt: string | null;
};

export function AwaitingSignaturesCard({
  jobs,
}: {
  jobs: AwaitingSignatureJobCard[];
}) {
  const { pushToast } = useToast();

  const handleCopyLink = async (shareLink: string | null) => {
    if (!shareLink) return;
    try {
      const absoluteUrl =
        shareLink.startsWith('http') || typeof window === 'undefined'
          ? shareLink
          : new URL(shareLink, window.location.origin).toString();
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(absoluteUrl);
      } else {
        window.prompt('Copy signature link', absoluteUrl);
      }
      pushToast({ title: 'Signature link copied', variant: 'success' });
    } catch (error) {
      console.error('Clipboard error', error);
      pushToast({
        title: 'Copy failed',
        description: 'Unable to copy the signature link.',
        variant: 'error',
      });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-0.5">
        <h2 className="text-[13px] font-medium text-[var(--color-text-primary)]">Awaiting signatures</h2>
        {jobs.length ? (
          <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[10px] bg-[var(--color-amber-bg)] px-1.5 text-[11px] font-medium text-[var(--color-amber)]">
            {jobs.length}
          </span>
        ) : null}
      </div>

      {jobs.length ? (
        <div className="space-y-2">
          {jobs.map((job) => (
            <AwaitingJobCard key={job.id} job={job} onCopy={handleCopyLink} />
          ))}
        </div>
      ) : (
        <p className="px-0.5 text-[13px] font-normal text-[var(--color-text-tertiary)]">
          No PDFs are currently awaiting remote signature.
        </p>
      )}
    </div>
  );
}

function AwaitingJobCard({
  job,
  onCopy,
}: {
  job: AwaitingSignatureJobCard;
  onCopy: (shareLink: string | null) => void | Promise<void>;
}) {
  const title = job.client_name ?? job.title ?? 'Job';
  const createdRelative = formatRelative(job.created_at);
  const expiresIn = formatDaysUntil(job.expiresAt);
  const metaParts = [
    createdRelative ? `Sent ${createdRelative}` : null,
    expiresIn ? `expires ${expiresIn}` : null,
  ].filter(Boolean);

  return (
    <article className="overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
      <div className="h-[3px] w-full bg-[var(--color-amber)]" aria-hidden="true" />
      <div className="px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium leading-tight text-[var(--color-text-primary)]">
              {title}
            </p>
            <p className="mt-0.5 truncate text-[12px] font-normal text-[var(--color-text-tertiary)]">
              Link sent to {title} · {job.address}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center rounded-[10px] bg-[var(--color-amber-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-amber)]">
            Awaiting
          </span>
        </div>

        {metaParts.length ? (
          <div className="mt-3 flex items-center gap-[7px] text-[13px] font-normal text-[var(--color-text-secondary)]">
            <span className="flex h-[14px] w-[14px] shrink-0 items-center justify-center">
              <ClockIcon />
            </span>
            <span className="truncate">{metaParts.join(' · ')}</span>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2 border-t-[0.5px] border-[var(--color-border-tertiary)] px-4 pb-3 pt-2.5">
        <Link
          href={job.shareLink ?? '#'}
          target="_blank"
          className="inline-flex h-9 flex-[2] items-center justify-center rounded-[18px] bg-[var(--color-cta)] text-[13px] font-medium text-[var(--color-cta-fg)] transition-colors hover:bg-[var(--color-text-primary)]"
        >
          Open signing link
        </Link>
        <button
          type="button"
          onClick={() => onCopy(job.shareLink)}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[18px] border-[0.5px] border-[var(--color-border-secondary)] bg-transparent text-[13px] font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-background-tertiary)]"
        >
          <SendIcon />
          Copy link
        </button>
        <Link
          href={`/jobs/${job.id}`}
          aria-label="Open job"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[18px] border-[0.5px] border-[var(--color-border-secondary)] bg-transparent text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-background-tertiary)] hover:text-[var(--color-text-primary)]"
        >
          <ExternalLinkIcon />
        </Link>
      </div>
    </article>
  );
}

function formatRelative(dateString: string | null | undefined) {
  if (!dateString) return null;
  const target = new Date(dateString).getTime();
  if (Number.isNaN(target)) return null;
  const diffMs = Date.now() - target;
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatDaysUntil(dateString: string | null | undefined) {
  if (!dateString) return null;
  const target = new Date(dateString).getTime();
  if (Number.isNaN(target)) return null;
  const diffDays = Math.ceil((target - Date.now()) / 86400000);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'in 1 day';
  return `in ${diffDays} days`;
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}
