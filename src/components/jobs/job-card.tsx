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

const getJobIconStyle = (status?: string | null): { bg: string; color: string } => {
  const s = (status ?? '').toLowerCase();
  if (['completed', 'closed', 'delivered'].includes(s)) return { bg: '#edf7f2', color: '#1a7a52' };
  if (s === 'issued') return { bg: '#e6f1fb', color: '#185fa5' };
  if (s === 'awaiting_landlord') return { bg: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)' };
  return { bg: '#faeeda', color: '#BA7517' };
};

const getActionStyle = (status?: string | null): string => {
  const s = (status ?? '').toLowerCase();
  if (['in_progress', 'active', 'draft', 'prepared'].includes(s)) {
    return 'bg-[#111] text-white';
  }
  if (s === 'issued') {
    return 'bg-[#edf7f2] text-[#1a7a52]';
  }
  return 'border-[0.5px] border-[var(--color-border-secondary)] bg-transparent text-[var(--color-text-secondary)]';
};

function JobIcon({ status, jobType }: { status?: string | null; jobType?: string | null }) {
  const s = (status ?? '').toLowerCase();
  const style = getJobIconStyle(status);

  if (['completed', 'closed', 'delivered'].includes(s)) {
    return (
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
        style={{ backgroundColor: style.bg }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={style.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    );
  }
  if (s === 'issued') {
    return (
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
        style={{ backgroundColor: style.bg }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={style.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      </div>
    );
  }
  if (s === 'awaiting_landlord') {
    return (
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
        style={{ backgroundColor: style.bg }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </div>
    );
  }
  // Active / in progress / draft / prepared — show wrench
  void jobType;
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
      style={{ backgroundColor: style.bg }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={style.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    </div>
  );
}

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
      className="flex items-center gap-3 rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-3.5 transition hover:border-[var(--color-border-secondary)]"
    >
      <JobIcon status={status} jobType={jobType} />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-[14px] font-medium text-[var(--color-text-primary)]">{title}</p>
          {displayDate ? (
            <span className="shrink-0 text-[11px] text-[var(--color-text-tertiary)]">{displayDate}</span>
          ) : null}
        </div>
        {jobTypeLabel ? (
          <p className="mt-0.5 text-[12px] text-[var(--color-text-secondary)]">{jobTypeLabel}</p>
        ) : null}
        {address ? (
          <p className="mt-0.5 truncate text-[12px] text-[var(--color-text-secondary)]">{address}</p>
        ) : null}
      </div>

      <span
        className={`ml-1 shrink-0 rounded-full px-3 py-1 text-[12px] font-medium ${getActionStyle(status)}`}
      >
        {actionLabel ?? 'Open'} →
      </span>
    </Link>
  );
}
