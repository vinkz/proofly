import Link from 'next/link';

import { JOB_TYPE_LABELS, type JobType } from '@/types/job-records';

type JobCardProps = {
  href: string;
  title: string;
  address?: string | null;
  status?: string | null;
  hasPdf?: boolean;
  scheduledFor?: string | null;
  createdAt?: string | null;
  jobType?: string | null;
  actionLabel?: string;
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatStatus = (value: string | null | undefined) =>
  value ? value.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) : 'Draft';

const getAccentClass = (status?: string | null) => {
  const s = (status ?? '').toLowerCase();
  if (s === 'issued') return 'bg-[var(--color-cta)]';
  if (['completed', 'closed', 'delivered'].includes(s)) return 'bg-[var(--color-action)]';
  return 'bg-[var(--color-border-secondary)]';
};

const getStatusBadgeClass = (status?: string | null) => {
  const s = (status ?? '').toLowerCase();
  if (s === 'issued') return 'bg-[var(--color-cta)]/10 text-[var(--color-cta)]';
  if (['completed', 'closed', 'delivered'].includes(s)) return 'bg-[var(--color-action-bg)] text-[var(--color-action)]';
  return 'bg-[var(--color-background-secondary)] text-[var(--color-text-tertiary)]';
};

const getActionChipClass = (status?: string | null) => {
  const s = (status ?? '').toLowerCase();
  if (s === 'issued') return 'bg-[var(--color-cta)] text-[var(--color-cta-fg)]';
  if (['completed', 'closed', 'delivered'].includes(s)) return 'bg-[var(--color-action-bg)] text-[var(--color-action)]';
  return 'border-[0.5px] border-[var(--color-border-secondary)] bg-transparent text-[var(--color-text-secondary)]';
};

export function JobCard({
  href,
  title,
  address,
  status,
  scheduledFor,
  createdAt,
  jobType,
  actionLabel,
}: JobCardProps) {
  const displayDate = formatDate(scheduledFor ?? createdAt);
  const jobTypeLabel =
    jobType && jobType in JOB_TYPE_LABELS
      ? JOB_TYPE_LABELS[jobType as JobType]
      : jobType
        ? jobType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
        : null;

  return (
    <Link
      href={href}
      className="block overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] transition hover:border-[var(--color-border-secondary)]"
    >
      <div className={`h-[3px] w-full ${getAccentClass(status)}`} aria-hidden="true" />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium text-[var(--color-text-primary)]">{title}</p>
            <p className="mt-0.5 truncate text-[13px] text-[var(--color-text-secondary)]">
              {address ?? 'No address'}
            </p>
          </div>
          {jobTypeLabel ? (
            <span className="shrink-0 rounded-[6px] bg-[var(--color-background-secondary)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
              {jobTypeLabel}
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t-[0.5px] border-[var(--color-border-tertiary)] pt-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-[6px] px-1.5 py-0.5 text-[11px] font-medium ${getStatusBadgeClass(status)}`}
            >
              {formatStatus(status)}
            </span>
            {displayDate ? (
              <span className="text-[12px] text-[var(--color-text-tertiary)]">{displayDate}</span>
            ) : null}
          </div>
          <span
            className={`inline-flex h-[28px] items-center justify-center rounded-[8px] px-2.5 text-[12px] font-medium ${getActionChipClass(status)}`}
          >
            {actionLabel ?? 'Open job'} →
          </span>
        </div>
      </div>
    </Link>
  );
}
