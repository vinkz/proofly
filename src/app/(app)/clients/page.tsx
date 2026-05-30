import Link from 'next/link';
import { redirect } from 'next/navigation';

import { listClientsWithCompliance, type ComplianceStatus, type ClientWithCompliance } from '@/server/clients';

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return (words[0][0] ?? '?').toUpperCase();
  return ((words[0][0] ?? '') + (words[words.length - 1][0] ?? '')).toUpperCase();
}

const AVATAR_STYLE: Record<ComplianceStatus, { bg: string; color: string }> = {
  overdue: { bg: '#fcebeb', color: '#a32d2d' },
  amber: { bg: '#faeeda', color: '#BA7517' },
  current: { bg: '#edf7f2', color: '#1a7a52' },
  unknown: { bg: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)' },
};

const BADGE_CONFIG: Record<ComplianceStatus, { bg: string; color: string; label: string } | null> = {
  overdue: { bg: '#fcebeb', color: '#a32d2d', label: 'Overdue' },
  amber: { bg: '#faeeda', color: '#BA7517', label: 'Due soon' },
  current: { bg: '#edf7f2', color: '#1a7a52', label: 'Current' },
  unknown: null,
};

function buildComplianceSummary(client: ClientWithCompliance): { text: string; color: string } | null {
  if (client.propertyCount === 0) return null;
  const propertyLabel = `${client.propertyCount} ${client.propertyCount === 1 ? 'property' : 'properties'}`;
  const parts: string[] = [];
  if (client.overdueCount > 0) parts.push(`${client.overdueCount} overdue`);
  if (client.amberCount > 0) {
    const dueText =
      client.dueSoonestDays !== null
        ? `${client.amberCount} due in ${client.dueSoonestDays} day${client.dueSoonestDays === 1 ? '' : 's'}`
        : `${client.amberCount} due soon`;
    parts.push(dueText);
  }
  if (client.currentCount > 0) parts.push(`${client.currentCount} current`);

  if (client.overdueCount > 0) {
    return { text: `${propertyLabel} - ${parts.join(', ')}`, color: '#a32d2d' };
  }
  if (client.amberCount > 0) {
    return {
      text: `${propertyLabel} - ${parts.join(', ')}`,
      color: '#BA7517',
    };
  }
  return {
    text: `${propertyLabel} - ${parts.length ? parts.join(', ') : 'all current'}`,
    color: 'var(--color-text-secondary)',
  };
}

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'amber', label: 'Due soon' },
  { value: 'current', label: 'Current' },
];

const matchesStatusFilter = (client: ClientWithCompliance, status: string): boolean => {
  if (!status) return true;
  if (status === 'overdue') return client.overdueCount > 0;
  if (status === 'amber') return client.amberCount > 0 && client.overdueCount === 0;
  if (status === 'current') return client.worstStatus === 'current';
  return true;
};

function ClientRow({ client, clientId }: { client: ClientWithCompliance; clientId: string }) {
  const displayName = client.landlord_name || client.name || 'Unnamed client';
  const avatar = AVATAR_STYLE[client.worstStatus];
  const initials = getInitials(displayName);
  const badge = BADGE_CONFIG[client.worstStatus];
  const summary = buildComplianceSummary(client);
  const subParts = [client.organization, client.propertyCount > 0 ? `${client.propertyCount} ${client.propertyCount === 1 ? 'property' : 'properties'}` : null].filter(Boolean);

  return (
    <Link
      href={`/clients/${clientId}`}
      className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-[var(--color-background-secondary)]/50"
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-medium"
        style={{ backgroundColor: avatar.bg, color: avatar.color }}
      >
        {initials}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-[var(--color-text-primary)]">{displayName}</p>
        {subParts.length > 0 ? (
          <p className="mt-0.5 truncate text-[12px] text-[var(--color-text-secondary)]">
            {subParts.join(' · ')}
          </p>
        ) : null}
        {summary ? (
          <p className="mt-0.5 text-[12px] font-medium" style={{ color: summary.color }}>
            {summary.text}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        {badge ? (
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ backgroundColor: badge.bg, color: badge.color }}
          >
            {badge.label}
          </span>
        ) : null}
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-text-tertiary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </Link>
  );
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string }>;
}) {
  const resolved = await searchParams;
  const q = typeof resolved?.q === 'string' ? resolved.q.trim() : '';
  const statusFilter = typeof resolved?.status === 'string' ? resolved.status : '';

  let clients: ClientWithCompliance[];
  try {
    clients = await listClientsWithCompliance(q || undefined);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      redirect('/login');
    }
    throw error;
  }

  const filtered = statusFilter ? clients.filter((c) => matchesStatusFilter(c, statusFilter)) : clients;

  const buildFilterUrl = (status: string) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    const qs = params.toString();
    return qs ? `/clients?${qs}` : '/clients';
  };

  const statsOverdue = clients.filter((c) => c.overdueCount > 0).length;
  const statsAmber = clients.filter((c) => c.worstStatus === 'amber').length;
  const statsCurrent = clients.filter((c) => c.worstStatus === 'current').length;

  const needsAttention = filtered.filter((c) => c.overdueCount > 0 || c.amberCount > 0);
  const allCurrent = filtered.filter((c) => c.overdueCount === 0 && c.amberCount === 0);

  return (
    <div className="min-h-full">
      {/* Page-level header */}
      <div className="border-b-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-[18px] py-[14px]">
          <h1 className="text-[20px] font-medium text-[var(--color-text-primary)]">Clients</h1>
          <Link
            href="/clients/new"
            className="flex h-8 w-8 items-center justify-center rounded-full border-[0.5px] border-[var(--color-border-secondary)] text-[var(--color-text-secondary)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span className="sr-only">Add client</span>
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-[12px] bg-[var(--color-background-secondary)] px-[14px] py-3">
            <p className="text-[22px] font-medium text-[var(--color-text-primary)]">{clients.length}</p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.4px] text-[var(--color-text-tertiary)]">
              Total clients
            </p>
          </div>
          <div className="rounded-[12px] bg-[var(--color-background-secondary)] px-[14px] py-3">
            <p className="text-[22px] font-medium" style={{ color: statsOverdue > 0 ? '#a32d2d' : 'var(--color-text-primary)' }}>
              {statsOverdue}
            </p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.4px] text-[var(--color-text-tertiary)]">
              Overdue
            </p>
          </div>
          <div className="rounded-[12px] bg-[var(--color-background-secondary)] px-[14px] py-3">
            <p className="text-[22px] font-medium" style={{ color: statsAmber > 0 ? '#BA7517' : 'var(--color-text-primary)' }}>
              {statsAmber}
            </p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.4px] text-[var(--color-text-tertiary)]">
              Due soon
            </p>
          </div>
          <div className="rounded-[12px] bg-[var(--color-background-secondary)] px-[14px] py-3">
            <p className="text-[22px] font-medium" style={{ color: statsCurrent > 0 ? '#1a7a52' : 'var(--color-text-primary)' }}>
              {statsCurrent}
            </p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.4px] text-[var(--color-text-tertiary)]">
              Current
            </p>
          </div>
        </div>

        {/* Search */}
        <form action="/clients" method="get">
          {statusFilter ? <input type="hidden" name="status" value={statusFilter} /> : null}
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search by name or email…"
              className="h-10 w-full rounded-[10px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] pl-10 pr-3 text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-action)] focus:outline-none"
            />
          </div>
        </form>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => {
            const active = f.value === statusFilter;
            return (
              <Link
                key={f.value}
                href={buildFilterUrl(f.value)}
                className={`rounded-full px-3 py-[5px] text-[12px] font-medium transition-colors ${
                  active
                    ? 'border-[0.5px] border-[#1a7a52] bg-[#edf7f2] text-[#1a7a52]'
                    : 'border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] text-[var(--color-text-secondary)]'
                }`}
              >
                {f.label}
              </Link>
            );
          })}
        </div>

        {/* Needs attention section */}
        {needsAttention.length > 0 ? (
          <div>
            <p className="mb-1.5 px-0.5 text-[13px] font-medium tracking-[0.3px] text-[var(--color-text-tertiary)]">
              Needs attention
            </p>
            <div className="overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
              {needsAttention.map((client, index) => (
                <div
                  key={client.id}
                  className={index > 0 ? 'border-t-[0.5px] border-[var(--color-border-tertiary)]' : ''}
                >
                  <ClientRow client={client} clientId={client.id} />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* All current section */}
        {allCurrent.length > 0 ? (
          <div>
            <p className="mb-1.5 px-0.5 text-[13px] font-medium tracking-[0.3px] text-[var(--color-text-tertiary)]">
              All current
            </p>
            <div className="overflow-hidden rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)]">
              {allCurrent.map((client, index) => (
                <div
                  key={client.id}
                  className={index > 0 ? 'border-t-[0.5px] border-[var(--color-border-tertiary)]' : ''}
                >
                  <ClientRow client={client} clientId={client.id} />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Empty states */}
        {filtered.length === 0 && clients.length > 0 ? (
          <div className="rounded-[16px] border-[0.5px] border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-6 text-center">
            <p className="text-[15px] font-medium text-[var(--color-text-primary)]">No clients match this filter</p>
            <Link
              href="/clients"
              className="mt-3 inline-flex h-8 items-center justify-center rounded-full border-[0.5px] border-[var(--color-border-secondary)] px-4 text-[12px] font-medium text-[var(--color-text-secondary)]"
            >
              Clear filters
            </Link>
          </div>
        ) : null}

        {clients.length === 0 ? (
          <div className="rounded-[16px] border-[0.5px] border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-6 text-center">
            <p className="text-[15px] font-medium text-[var(--color-text-primary)]">No clients yet</p>
            <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
              Clients are created when you start jobs or receive landlord requests.
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
