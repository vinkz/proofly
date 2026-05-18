import Link from 'next/link';
import { redirect } from 'next/navigation';

import { listClients } from '@/server/clients';

const formatDate = (value: string | null | undefined) => {
  if (!value) return 'No activity';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No activity';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export default async function ClientsPage() {
  let clients;
  try {
    clients = await listClients();
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      redirect('/login');
    }
    throw error;
  }

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
          Contact records used for job requests, repeat visits, and delivery emails.
        </p>
      </div>

      <div className="grid gap-3">
        {clients.map((client) => (
          <Link
            key={client.id}
            href={`/clients/${client.id}`}
            className="block rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4 transition hover:border-[var(--color-border-secondary)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-medium text-[var(--color-text-primary)]">
                  {client.landlord_name || client.name || 'Unnamed client'}
                </p>
                {client.organization ? (
                  <p className="mt-0.5 truncate text-[13px] text-[var(--color-text-secondary)]">
                    {client.organization}
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 rounded-full bg-[var(--color-background-secondary)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-secondary)]">
                {formatDate(client.updated_at ?? client.created_at)}
              </span>
            </div>
            <div className="mt-3 grid gap-1 border-t-[0.5px] border-[var(--color-border-tertiary)] pt-3 text-[13px] text-[var(--color-text-secondary)]">
              {client.email ? <span className="truncate">{client.email}</span> : null}
              {client.phone ? <span className="truncate">{client.phone}</span> : null}
              {client.address || client.landlord_address ? (
                <span className="truncate">{client.address || client.landlord_address}</span>
              ) : null}
            </div>
          </Link>
        ))}

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
