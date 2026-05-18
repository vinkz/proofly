import Link from 'next/link';
import { redirect } from 'next/navigation';

import { listJobs } from '@/server/jobs';

type PropertySummary = {
  key: string;
  address: string;
  clientName: string | null;
  latestJobId: string;
  latestJobStatus: string | null;
  latestJobType: string | null;
  latestAt: string | null;
  jobCount: number;
};

const normalizeAddressKey = (address: string) =>
  address
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();

const formatDate = (value: string | null) => {
  if (!value) return 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No date';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatStatus = (value: string | null) =>
  value
    ? value
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    : 'Draft';

const getLatestJobHref = (property: PropertySummary) => {
  const status = String(property.latestJobStatus ?? '').toLowerCase();
  if (status === 'issued') return `/jobs/${property.latestJobId}/complete`;
  if (['completed', 'closed', 'delivered'].includes(status)) return `/jobs/${property.latestJobId}/pdf`;
  return `/jobs/${property.latestJobId}`;
};

const getActionLabel = (property: PropertySummary) => {
  const status = String(property.latestJobStatus ?? '').toLowerCase();
  if (status === 'issued') return 'Review & send';
  if (['completed', 'closed', 'delivered'].includes(status)) return 'Open PDF';
  return 'Open job';
};

const getAccentClass = (property: PropertySummary) => {
  const status = String(property.latestJobStatus ?? '').toLowerCase();
  if (status === 'issued') return 'bg-[var(--color-cta)]';
  if (['completed', 'closed', 'delivered'].includes(status)) return 'bg-[var(--color-action)]';
  if (['draft', 'prepared'].includes(status)) return 'bg-[var(--color-border-secondary)]';
  return 'bg-[var(--color-border-secondary)]';
};

const getActionChipClass = (property: PropertySummary) => {
  const status = String(property.latestJobStatus ?? '').toLowerCase();
  if (status === 'issued') return 'bg-[var(--color-cta)] text-[var(--color-cta-fg)]';
  if (['completed', 'closed', 'delivered'].includes(status)) return 'bg-[var(--color-action-bg)] text-[var(--color-action)]';
  return 'border-[0.5px] border-[var(--color-border-secondary)] bg-transparent text-[var(--color-text-secondary)]';
};

const getStatusBadgeClass = (property: PropertySummary) => {
  const status = String(property.latestJobStatus ?? '').toLowerCase();
  if (status === 'issued') return 'bg-[var(--color-cta)]/10 text-[var(--color-cta)]';
  if (['completed', 'closed', 'delivered'].includes(status)) return 'bg-[var(--color-action-bg)] text-[var(--color-action)]';
  return 'bg-[var(--color-background-secondary)] text-[var(--color-text-tertiary)]';
};

export default async function PropertiesPage() {
  let jobGroups;
  try {
    jobGroups = await listJobs();
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      redirect('/login');
    }
    throw error;
  }

  const properties = [...jobGroups.active, ...jobGroups.completed].reduce<Map<string, PropertySummary>>((acc, rawJob) => {
    const job = rawJob as Record<string, unknown>;
    const address = typeof job.address === 'string' && job.address.trim() ? job.address.trim() : '';
    const id = typeof job.id === 'string' ? job.id : '';
    if (!address || !id) return acc;

    const key = normalizeAddressKey(address) || id;
    const latestAt =
      typeof job.scheduled_for === 'string'
        ? job.scheduled_for
        : typeof job.created_at === 'string'
          ? job.created_at
          : null;
    const current = acc.get(key);
    const currentTime = current?.latestAt ? new Date(current.latestAt).getTime() : 0;
    const nextTime = latestAt ? new Date(latestAt).getTime() : 0;

    if (!current) {
      acc.set(key, {
        key,
        address,
        clientName: typeof job.client_name === 'string' ? job.client_name : null,
        latestJobId: id,
        latestJobStatus: typeof job.status === 'string' ? job.status : null,
        latestJobType: typeof job.job_type === 'string' ? job.job_type : null,
        latestAt,
        jobCount: 1,
      });
      return acc;
    }

    current.jobCount += 1;
    if (nextTime >= currentTime) {
      current.address = address;
      current.clientName = typeof job.client_name === 'string' ? job.client_name : current.clientName;
      current.latestJobId = id;
      current.latestJobStatus = typeof job.status === 'string' ? job.status : null;
      current.latestJobType = typeof job.job_type === 'string' ? job.job_type : null;
      current.latestAt = latestAt;
    }
    return acc;
  }, new Map<string, PropertySummary>());

  const rows = Array.from(properties.values()).sort((a, b) => {
    const left = a.latestAt ? new Date(a.latestAt).getTime() : 0;
    const right = b.latestAt ? new Date(b.latestAt).getTime() : 0;
    return right - left;
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <div className="flex items-center justify-between gap-3 pt-1">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">
            Your properties
          </p>
          <h1 className="mt-0.5 text-[22px] font-semibold tracking-[-0.02em] text-[var(--color-text-primary)]">
            Properties
          </h1>
        </div>
        <Link
          href="/jobs/new"
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[20px] bg-[var(--color-cta)] px-4 text-[13px] font-medium text-[var(--color-cta-fg)]"
        >
          + New job
        </Link>
      </div>

      <div className="grid gap-3">
        {rows.map((property) => (
          <Link
            key={property.key}
            href={getLatestJobHref(property)}
            className="block overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] transition hover:border-[var(--color-border-secondary)]"
          >
            <div className={`h-[3px] w-full ${getAccentClass(property)}`} aria-hidden="true" />
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-[var(--color-text-primary)]">
                    {property.address}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-[var(--color-text-secondary)]">
                    {property.clientName || 'No landlord linked'}
                  </p>
                </div>
                <span className="shrink-0 rounded-[6px] bg-[var(--color-background-secondary)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
                  {property.jobCount} {property.jobCount === 1 ? 'job' : 'jobs'}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 border-t-[0.5px] border-[var(--color-border-tertiary)] pt-3">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-[6px] px-1.5 py-0.5 text-[11px] font-medium ${getStatusBadgeClass(property)}`}>
                    {formatStatus(property.latestJobStatus)}
                  </span>
                  <span className="text-[12px] text-[var(--color-text-tertiary)]">{formatDate(property.latestAt)}</span>
                </div>
                <span className={`inline-flex h-[28px] items-center justify-center rounded-[8px] px-2.5 text-[12px] font-medium ${getActionChipClass(property)}`}>
                  {getActionLabel(property)} →
                </span>
              </div>
            </div>
          </Link>
        ))}
        {rows.length === 0 ? (
          <div className="rounded-[16px] border-[0.5px] border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-8 text-center">
            <p className="text-[15px] font-medium text-[var(--color-text-primary)]">No properties yet</p>
            <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
              Create a job and the property will appear here automatically.
            </p>
            <Link
              href="/jobs/new"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-[20px] bg-[var(--color-cta)] px-5 text-[13px] font-medium text-[var(--color-cta-fg)]"
            >
              New job
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
