import Link from 'next/link';
import { redirect } from 'next/navigation';

import { listClientsWithCompliance, type ComplianceStatus, type ClientWithCompliance } from '@/server/clients';

const formatDate = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const COMPLIANCE_CONFIG: Record<ComplianceStatus, { label: string; badgeClass: string } | null> = {
  overdue: { label: 'Overdue', badgeClass: 'bg-[var(--color-red)]/10 text-[var(--color-red)]' },
  amber: { label: 'Due soon', badgeClass: 'bg-[var(--color-amber)]/10 text-[var(--color-amber)]' },
  current: { label: 'Current', badgeClass: 'bg-[var(--color-action-bg)] text-[var(--color-action)]' },
  unknown: null,
};

const buildPropertySummary = (client: ClientWithCompliance) => {
  const { propertyCount, overdueCount, amberCount, currentCount } = client;
  if (!propertyCount) return null;
  const parts: string[] = [];
  if (overdueCount) parts.push(`${overdueCount} overdue`);
  if (amberCount) parts.push(`${amberCount} due soon`);
  if (currentCount) parts.push(`${currentCount} current`);
  const label = `${propertyCount} ${propertyCount === 1 ? 'property' : 'properties'}`;
  return parts.length ? `${label} — ${parts.join(', ')}` : label;
};

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

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <div className="rounded-[18px] bg-[var(--color-background-primary)] p-5 shadow-sm">
        <p className="text-[12px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">
          Landlords
        </p>
        <h1 className="mt-1 text-[24px] font-semibold tracking-[-0.02em] text-[var(--color-text-primary)]">
          Clients
        </h1>
        <p className="mt-1 text-[14px] leading-6 text-[var(--color-text-secondary)]">
          Compliance health at a glance. Tap a client to see their properties and job history.
        </p>
      </div>

      {/* Search */}
      <form action="/clients" method="get" className="flex gap-2">
        {statusFilter ? <input type="hidden" name="status" value={statusFilter} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by name or email…"
          className="h-[38px] min-w-0 flex-1 rounded-[10px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-action)] focus:outline-none"
        />
        <button
          type="submit"
          className="inline-flex h-[38px] items-center justify-center rounded-[10px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 text-[13px] text-[var(--color-text-secondary)] hover:border-[var(--color-action)]"
        >
          Search
        </button>
      </form>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => {
          const active = f.value === statusFilter;
          return (
            <Link
              key={f.value}
              href={buildFilterUrl(f.value)}
              className={`inline-flex h-[30px] items-center rounded-full px-3 text-[12px] font-medium transition-colors ${
                active
                  ? 'bg-[var(--color-text-primary)] text-[var(--color-background-primary)]'
                  : 'border-[0.5px] border-[var(--color-border-secondary)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-primary)]'
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <div className="grid gap-3">
        {filtered.map((client) => {
          const name = client.landlord_name || client.name || 'Unnamed client';
          const badge = COMPLIANCE_CONFIG[client.worstStatus];
          const summary = buildPropertySummary(client);
          return (
            <Link
              key={client.id}
              href={`/clients/${client.id}`}
              className="block rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4 transition hover:border-[var(--color-border-secondary)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium text-[var(--color-text-primary)]">{name}</p>
                  {client.organization ? (
                    <p className="mt-0.5 truncate text-[13px] text-[var(--color-text-secondary)]">{client.organization}</p>
                  ) : null}
                </div>
                {badge ? (
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${badge.badgeClass}`}>
                    {badge.label}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-[var(--color-background-secondary)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-tertiary)]">
                    {formatDate(client.updated_at ?? client.created_at) ?? 'No activity'}
                  </span>
                )}
              </div>

              <div className="mt-3 space-y-1 border-t-[0.5px] border-[var(--color-border-tertiary)] pt-3 text-[13px] text-[var(--color-text-secondary)]">
                {summary ? (
                  <p className="font-medium text-[var(--color-text-primary)]">{summary}</p>
                ) : null}
                {client.email ? <p className="truncate">{client.email}</p> : null}
                {client.phone ? <p className="truncate">{client.phone}</p> : null}
                {!summary && (client.address || client.landlord_address) ? (
                  <p className="truncate">{client.address || client.landlord_address}</p>
                ) : null}
              </div>
            </Link>
          );
        })}

        {filtered.length === 0 && clients.length > 0 ? (
          <div className="rounded-[16px] border-[0.5px] border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-6 text-center">
            <p className="text-[15px] font-medium text-[var(--color-text-primary)]">No clients match this filter</p>
            <Link
              href="/clients"
              className="mt-3 inline-flex h-9 items-center justify-center rounded-[18px] border-[0.5px] border-[var(--color-border-secondary)] px-4 text-[13px] text-[var(--color-text-secondary)]"
            >
              Clear filters
            </Link>
          </div>
        ) : null}

        {clients.length === 0 ? (
          <div className="rounded-[16px] border-[0.5px] border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] p-6 text-center">
            <h2 className="text-[16px] font-medium text-[var(--color-text-primary)]">No clients yet</h2>
            <p className="mt-1 text-[14px] text-[var(--color-text-secondary)]">
              Clients are created when you start jobs or receive landlord requests.
            </p>
            <Link
              href="/jobs/new"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-[20px] bg-[var(--color-cta)] px-4 text-[13px] font-medium text-[var(--color-cta-fg)]"
            >
              New job
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}
