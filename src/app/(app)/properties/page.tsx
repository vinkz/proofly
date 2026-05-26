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

const getComplianceBadgeClass = (status: ComplianceStatus) => {
  if (status === 'overdue') return 'bg-[var(--color-red)]/10 text-[var(--color-red)]';
  if (status === 'amber') return 'bg-[var(--color-amber)]/10 text-[var(--color-amber)]';
  if (status === 'current') return 'bg-[var(--color-action-bg)] text-[var(--color-action)]';
  return 'bg-[var(--color-background-secondary)] text-[var(--color-text-tertiary)]';
};

const getComplianceBadgeLabel = (status: ComplianceStatus, nextServiceDue: string | null) => {
  if (status === 'overdue') return 'Overdue';
  if (status === 'amber') {
    const due = new Date(`${nextServiceDue!.slice(0, 10)}T00:00:00`).getTime();
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const daysUntil = Math.floor((due - todayStart) / 86_400_000);
    return `Due in ${daysUntil}d`;
  }
  if (status === 'current') return 'Current';
  return 'No date';
};

const getAccentClass = (status: ComplianceStatus) => {
  if (status === 'overdue') return 'bg-[var(--color-red)]';
  if (status === 'amber') return 'bg-[var(--color-amber)]';
  if (status === 'current') return 'bg-[var(--color-action)]';
  return 'bg-[var(--color-border-secondary)]';
};

type StatusFilter = 'overdue' | 'amber' | 'current' | 'all';

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusParam } = await searchParams;
  const activeFilter: StatusFilter =
    statusParam === 'overdue' || statusParam === 'amber' || statusParam === 'current'
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

  const allProperties = (properties ?? []).map((p) => {
    const complianceStatus = getComplianceStatus(p.next_service_due ?? null);
    const address = [p.address_line1, p.address_line2, p.town, p.postcode]
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      .join(', ');
    return { ...p, address, complianceStatus };
  });

  const filteredProperties =
    activeFilter === 'all'
      ? allProperties
      : allProperties.filter((p) => p.complianceStatus === activeFilter);

  const filterChips: Array<{ label: string; value: StatusFilter; count: number }> = [
    { label: 'All', value: 'all', count: allProperties.length },
    { label: 'Overdue', value: 'overdue', count: allProperties.filter((p) => p.complianceStatus === 'overdue').length },
    { label: 'Due soon', value: 'amber', count: allProperties.filter((p) => p.complianceStatus === 'amber').length },
    { label: 'Current', value: 'current', count: allProperties.filter((p) => p.complianceStatus === 'current').length },
  ];

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

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {filterChips.map((chip) => (
          <Link
            key={chip.value}
            href={chip.value === 'all' ? '/properties' : `/properties?status=${chip.value}`}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition ${
              activeFilter === chip.value
                ? 'bg-[var(--color-text-primary)] text-[var(--color-background-primary)]'
                : 'border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-primary)]'
            }`}
          >
            {chip.label}
            {chip.count > 0 ? (
              <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
                activeFilter === chip.value
                  ? 'bg-[var(--color-background-primary)]/20 text-[var(--color-background-primary)]'
                  : 'bg-[var(--color-background-secondary)] text-[var(--color-text-tertiary)]'
              }`}>
                {chip.count}
              </span>
            ) : null}
          </Link>
        ))}
      </div>

      <div className="grid gap-3">
        {filteredProperties.map((property) => (
          <Link
            key={property.id}
            href={`/p/${property.public_token}`}
            className="block overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] transition hover:border-[var(--color-border-secondary)]"
          >
            <div className={`h-[3px] w-full ${getAccentClass(property.complianceStatus)}`} aria-hidden="true" />
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-[var(--color-text-primary)]">
                    {property.name || property.address.split(',')[0] || 'Unnamed property'}
                  </p>
                  {property.name && property.address ? (
                    <p className="mt-0.5 truncate text-[13px] text-[var(--color-text-secondary)]">
                      {property.address}
                    </p>
                  ) : null}
                </div>
                <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${getComplianceBadgeClass(property.complianceStatus)}`}>
                  {getComplianceBadgeLabel(property.complianceStatus, property.next_service_due ?? null)}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 border-t-[0.5px] border-[var(--color-border-tertiary)] pt-3">
                <p className="text-[12px] text-[var(--color-text-tertiary)]">
                  {property.next_service_due
                    ? `Next due: ${formatDate(property.next_service_due)}`
                    : 'No service date recorded'}
                </p>
                <span className="inline-flex h-[28px] items-center justify-center rounded-[8px] border-[0.5px] border-[var(--color-border-secondary)] bg-transparent px-2.5 text-[12px] font-medium text-[var(--color-text-secondary)]">
                  View vault →
                </span>
              </div>
            </div>
          </Link>
        ))}
        {filteredProperties.length === 0 && allProperties.length > 0 ? (
          <div className="rounded-[16px] border-[0.5px] border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-8 text-center">
            <p className="text-[15px] font-medium text-[var(--color-text-primary)]">No properties match this filter</p>
            <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
              Try selecting a different status filter above.
            </p>
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="rounded-[16px] border-[0.5px] border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-8 text-center">
            <p className="text-[15px] font-medium text-[var(--color-text-primary)]">No properties yet</p>
            <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
              Properties appear automatically when you deliver jobs.
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
