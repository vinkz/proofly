import Link from 'next/link';
import { clsx } from 'clsx';

type JobCardProps = {
  id: string;
  title: string;
  address?: string | null;
  status?: string | null;
  hasPdf?: boolean;
  scheduledFor?: string | null;
  createdAt?: string | null;
};

const statusColors: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-700',
  'awaiting_signatures': 'bg-orange-100 text-orange-700',
  'awaiting_report': 'bg-indigo-100 text-indigo-700',
  completed: 'bg-emerald-100 text-emerald-700',
  default: 'bg-gray-100 text-gray-700',
};

function formatDate(dateString?: string | null) {
  if (!dateString) return null;
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString();
}

export function JobCard({ id, title, address, status, hasPdf, scheduledFor, createdAt }: JobCardProps) {
  const color = statusColors[status ?? ''] ?? statusColors.default;
  const displayDate = formatDate(scheduledFor ?? createdAt);
  return (
    <Link
      href={`/jobs/${id}`}
      className="group block rounded-md border border-white/30 bg-white/80 p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">Job</p>
          <h3 className="text-lg font-semibold text-muted">{title}</h3>
          <p className="text-sm text-muted-foreground/70">{address ?? 'Address pending'}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={clsx('rounded-full px-3 py-1 text-xs font-semibold', color)}>
            {status?.replace('_', ' ') ?? 'Draft'}
          </span>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground/60">
        {hasPdf ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--muted)] px-2 py-1 font-semibold text-[var(--brand)]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M6 4h9l5 5v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" strokeWidth="1.6" />
              <path d="M14 4v5h5" strokeWidth="1.6" />
            </svg>
            PDF
          </span>
        ) : null}
        {displayDate ? (
          <span className="rounded-full bg-white/80 px-2 py-1 font-semibold text-[var(--accent)]">Date: {displayDate}</span>
        ) : null}
      </div>
    </Link>
  );
}
