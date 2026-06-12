import Link from 'next/link';
import { redirect } from 'next/navigation';

import { requireUser } from '@/lib/supabaseServer';

const formatDate = (value: string | null) => {
  if (!value) return null;
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

type ComplianceStatus = 'overdue' | 'amber' | 'current' | 'unknown';

const getComplianceStatus = (nextServiceDue: string | null): ComplianceStatus => {
  if (!nextServiceDue) return 'unknown';
  const due = new Date(`${nextServiceDue.slice(0, 10)}T00:00:00`).getTime();
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const daysUntil = Math.floor((due - todayStart) / 86_400_000);
  if (daysUntil < 0) return 'overdue';
  if (daysUntil <= 45) return 'amber';
  return 'current';
};

const getDaysUntil = (nextServiceDue: string | null): number | null => {
  if (!nextServiceDue) return null;
  const due = new Date(`${nextServiceDue.slice(0, 10)}T00:00:00`).getTime();
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.floor((due - todayStart) / 86_400_000);
};

const DOT_COLOR: Record<ComplianceStatus, string> = {
  overdue: '#a32d2d',
  amber: '#BA7517',
  current: '#1a7a52',
  unknown: 'var(--color-border-secondary)',
};

const STATUS_LABEL: Record<ComplianceStatus, string> = {
  overdue: 'Overdue',
  amber: 'Due soon',
  current: 'Current',
  unknown: 'No cert',
};

function getComplianceText(
  status: ComplianceStatus,
  nextServiceDue: string | null,
): { text: string; color: string } {
  if (status === 'overdue') {
    const d = formatDate(nextServiceDue);
    return { text: `CP12 overdue — expired ${d ?? 'date unknown'}`, color: '#a32d2d' };
  }
  if (status === 'amber') {
    const days = getDaysUntil(nextServiceDue);
    return {
      text: days !== null ? `CP12 due in ${days} day${days !== 1 ? 's' : ''}` : 'CP12 due soon',
      color: '#BA7517',
    };
  }
  if (status === 'current') {
    const d = formatDate(nextServiceDue);
    return { text: `Next CP12 due ${d ?? 'date unknown'}`, color: 'var(--color-text-tertiary)' };
  }
  return { text: 'No certificate on record', color: 'var(--color-text-tertiary)' };
}

type StatusFilter = 'overdue' | 'amber' | 'current' | 'no_cert' | 'all';

type PropertyRow = {
  id: string;
  client_id: string | null;
  public_token: string | null;
  name: string | null;
  address: string;
  complianceStatus: ComplianceStatus;
  next_service_due: string | null;
};

function PropertyCard({ property }: { property: PropertyRow }) {
  const displayName = property.name || property.address.split(',')[0] || 'Unnamed property';
  const secondaryLine = property.name ? property.address : null;
  const compText = getComplianceText(property.complianceStatus, property.next_service_due);
  const isUrgent = property.complianceStatus === 'overdue' || property.complianceStatus === 'unknown';

  return (
    <div className="relative flex items-start gap-3 px-4 py-3.5">
      {/* Full-card link to vault */}
      {property.public_token ? (
        <Link
          href={`/p/${property.public_token}`}
          className="absolute inset-0 rounded-none"
          aria-label={`View ${displayName}`}
        >
          <span className="sr-only">{displayName}</span>
        </Link>
      ) : null}

      {/* Building icon */}
      <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      </div>

      {/* Content */}
      <div className="relative z-10 min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-[var(--color-text-primary)]">{displayName}</p>
        {secondaryLine ? (
          <p className="mt-0.5 truncate text-[12px] text-[var(--color-text-secondary)]">{secondaryLine}</p>
        ) : null}
        <p className="mt-0.5 text-[12px] font-medium" style={{ color: compText.color }}>
          {compText.text}
        </p>
      </div>

      {/* Right side: status + action */}
      <div className="relative z-10 flex shrink-0 flex-col items-end gap-2">
        <div className="flex items-center gap-1.5">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: DOT_COLOR[property.complianceStatus] }}
            aria-hidden="true"
          />
          <span className="text-[12px] font-medium" style={{ color: DOT_COLOR[property.complianceStatus] }}>
            {STATUS_LABEL[property.complianceStatus]}
          </span>
        </div>
        {property.complianceStatus === 'current' ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        ) : (
          <Link
            href={`/jobs/new?${new URLSearchParams(
              Object.entries({
                propertyId: property.id,
                clientId: property.client_id ?? '',
              }).filter(([, value]) => value),
            ).toString()}`}
            className={`inline-flex h-7 items-center justify-center rounded-full px-3 text-[12px] font-medium ${
              isUrgent
                ? 'bg-[#111] text-white'
                : 'border-[0.5px] border-[var(--color-border-secondary)] bg-transparent text-[var(--color-text-secondary)]'
            }`}
          >
            New job
          </Link>
        )}
      </div>
    </div>
  );
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusParam } = await searchParams;
  const activeFilter: StatusFilter =
    statusParam === 'overdue' || statusParam === 'amber' || statusParam === 'current' || statusParam === 'no_cert'
      ? statusParam
      : 'all';

  let sb: Awaited<ReturnType<typeof requireUser>>['sb'];
  let userId: string;
  try {
    const result = await requireUser();
    sb = result.sb;
    userId = result.user.id;
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      redirect('/login');
    }
    throw error;
  }

  const { data: properties, error } = await sb
    .from('properties')
    .select('id, user_id, client_id, name, address_line1, address_line2, town, postcode, next_service_due, public_token, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);

  const allProperties: PropertyRow[] = (properties ?? []).map((p) => {
    const complianceStatus = getComplianceStatus(p.next_service_due ?? null);
    const address = [p.address_line1, p.address_line2, p.town, p.postcode]
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      .join(', ');
    return {
      id: p.id,
      client_id: p.client_id ?? null,
      public_token: p.public_token ?? null,
      name: p.name ?? null,
      address,
      complianceStatus,
      next_service_due: p.next_service_due ?? null,
    };
  });

  const filteredProperties =
    activeFilter === 'all'
      ? allProperties
      : activeFilter === 'no_cert'
        ? allProperties.filter((p) => p.complianceStatus === 'unknown')
        : allProperties.filter((p) => p.complianceStatus === activeFilter);

  const statsOverdue = allProperties.filter((p) => p.complianceStatus === 'overdue').length;
  const statsAmber = allProperties.filter((p) => p.complianceStatus === 'amber').length;
  const statsCurrent = allProperties.filter((p) => p.complianceStatus === 'current').length;

  const needsAttentionProps = filteredProperties.filter(
    (p) => p.complianceStatus === 'overdue' || p.complianceStatus === 'amber',
  );
  const currentProps = filteredProperties.filter((p) => p.complianceStatus === 'current');
  const noCertProps = filteredProperties.filter((p) => p.complianceStatus === 'unknown');

  const filterChips: Array<{ label: string; value: StatusFilter }> = [
    { label: 'All', value: 'all' },
    { label: 'Overdue', value: 'overdue' },
    { label: 'Due soon', value: 'amber' },
    { label: 'Current', value: 'current' },
    { label: 'No cert yet', value: 'no_cert' },
  ];

  return (
    <div className="min-h-full">
      {/* Page header */}
      <div className="border-b-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-[18px] py-[14px]">
          <h1 className="text-[20px] font-medium text-[var(--color-text-primary)]">Properties</h1>
          <Link
            href="/jobs/new"
            className="flex h-8 w-8 items-center justify-center rounded-full border-[0.5px] border-[var(--color-border-secondary)] text-[var(--color-text-secondary)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span className="sr-only">New job</span>
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-[12px] bg-[var(--color-background-secondary)] px-[14px] py-3">
            <p className="text-[22px] font-medium text-[var(--color-text-primary)]">{allProperties.length}</p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.4px] text-[var(--color-text-eyebrow)]">Total</p>
          </div>
          <div className="rounded-[12px] bg-[var(--color-background-secondary)] px-[14px] py-3">
            <p className="text-[22px] font-medium" style={{ color: statsOverdue > 0 ? '#a32d2d' : 'var(--color-text-primary)' }}>
              {statsOverdue}
            </p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.4px] text-[var(--color-text-eyebrow)]">Overdue</p>
          </div>
          <div className="rounded-[12px] bg-[var(--color-background-secondary)] px-[14px] py-3">
            <p className="text-[22px] font-medium" style={{ color: statsAmber > 0 ? '#BA7517' : 'var(--color-text-primary)' }}>
              {statsAmber}
            </p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.4px] text-[var(--color-text-eyebrow)]">Due soon</p>
          </div>
          <div className="rounded-[12px] bg-[var(--color-background-secondary)] px-[14px] py-3">
            <p className="text-[22px] font-medium" style={{ color: statsCurrent > 0 ? '#1a7a52' : 'var(--color-text-primary)' }}>
              {statsCurrent}
            </p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.4px] text-[var(--color-text-eyebrow)]">Current</p>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-1.5">
          {filterChips.map((chip) => (
            <Link
              key={chip.value}
              href={chip.value === 'all' ? '/properties' : `/properties?status=${chip.value}`}
              className={`rounded-full px-3 py-[5px] text-[12px] font-medium transition ${
                activeFilter === chip.value
                  ? 'border-[0.5px] border-[#1a7a52] bg-[#edf7f2] text-[#1a7a52]'
                  : 'border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] text-[var(--color-text-secondary)]'
              }`}
            >
              {chip.label}
            </Link>
          ))}
        </div>

        {/* Needs attention section */}
        {needsAttentionProps.length > 0 ? (
          <div>
            <p className="mb-1.5 px-0.5 text-[13px] font-medium tracking-[0.3px] text-[var(--color-text-tertiary)]">
              Needs attention
            </p>
            <div className="overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
              {needsAttentionProps.map((property, index) => (
                <div
                  key={property.id}
                  className={index > 0 ? 'border-t-[0.5px] border-[var(--color-border-tertiary)]' : ''}
                >
                  <PropertyCard property={property} />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Current section */}
        {currentProps.length > 0 ? (
          <div>
            <p className="mb-1.5 px-0.5 text-[13px] font-medium tracking-[0.3px] text-[var(--color-text-tertiary)]">
              Current
            </p>
            <div className="overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
              {currentProps.map((property, index) => (
                <div
                  key={property.id}
                  className={index > 0 ? 'border-t-[0.5px] border-[var(--color-border-tertiary)]' : ''}
                >
                  <PropertyCard property={property} />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* No certificate yet section */}
        {noCertProps.length > 0 ? (
          <div>
            <p className="mb-1.5 px-0.5 text-[13px] font-medium tracking-[0.3px] text-[var(--color-text-tertiary)]">
              No certificate yet
            </p>
            <div className="overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
              {noCertProps.map((property, index) => (
                <div
                  key={property.id}
                  className={index > 0 ? 'border-t-[0.5px] border-[var(--color-border-tertiary)]' : ''}
                >
                  <PropertyCard property={property} />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Empty states */}
        {filteredProperties.length === 0 && allProperties.length > 0 ? (
          <div className="rounded-[16px] border-[0.5px] border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-8 text-center">
            <p className="text-[15px] font-medium text-[var(--color-text-primary)]">No properties match this filter</p>
            <Link
              href="/properties"
              className="mt-3 inline-flex h-8 items-center justify-center rounded-full border-[0.5px] border-[var(--color-border-secondary)] px-4 text-[12px] font-medium text-[var(--color-text-secondary)]"
            >
              Clear filter
            </Link>
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="rounded-[16px] border-[0.5px] border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-8 text-center">
            <p className="text-[15px] font-medium text-[var(--color-text-primary)]">No properties yet</p>
            <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
              Properties appear here automatically after your first delivered job — nothing to set up.
            </p>
            <Link
              href="/jobs/new"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-[24px] bg-[#111] px-5 text-[13px] font-medium text-white"
            >
              New job
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
