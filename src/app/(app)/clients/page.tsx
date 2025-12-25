import Link from 'next/link';

import { listClients } from '@/server/clients';
import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { DeleteClientButton } from '@/components/clients/delete-client-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = typeof params?.q === 'string' ? params.q : '';
  const clients = await listClients(query);
  const supabase = await supabaseServerReadOnly();
  const clientIds = clients.flatMap((client) => client.client_ids ?? [client.id]);
  const { data: jobs } = clientIds.length
    ? await supabase
        .from('jobs')
        .select('client_id, status')
        .in('client_id', clientIds)
    : { data: [] };
  const clientIdMap = new Map<string, string>();
  clients.forEach((client) => {
    const ids = client.client_ids ?? [client.id];
    ids.forEach((id) => clientIdMap.set(id, client.id));
  });
  const jobStats = (jobs ?? []).reduce<Record<string, { open: number; total: number }>>((acc, job) => {
    const key = job.client_id ?? '';
    const groupKey = key ? clientIdMap.get(key) ?? '' : '';
    if (!groupKey) return acc;
    acc[groupKey] = acc[groupKey]
      ? {
          open: acc[groupKey].open + (job.status === 'completed' ? 0 : 1),
          total: acc[groupKey].total + 1,
        }
      : {
          open: job.status === 'completed' ? 0 : 1,
          total: 1,
        };
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--accent)]">CRM</p>
          <h1 className="text-3xl font-semibold text-muted">Clients</h1>
          <p className="text-sm text-muted-foreground/70">Stay on top of relationships and field history.</p>
        </div>
        <Button asChild>
          <Link href="/clients/new">+ New client</Link>
        </Button>
      </header>

      <form className="flex flex-col gap-3 rounded-2xl border border-white/20 bg-white/70 p-4 md:flex-row" action="/clients" method="get">
        <Input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search clients by name, company, or email"
          className="flex-1"
        />
        <Button type="submit" className="md:w-40">
          Search
        </Button>
      </form>

      <section className="grid gap-4 md:grid-cols-2">
        {clients.map((client) => {
          const stats = jobStats[client.id] ?? { open: 0, total: 0 };
          return (
            <div
              key={client.id}
              className="group rounded-3xl border border-white/20 bg-white/80 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div>
                  <Link className="text-lg font-semibold text-muted hover:underline" href={`/clients/${client.id}`}>
                    {client.name}
                  </Link>
                  <p className="text-xs text-muted-foreground/60">{client.organization ?? 'Individual'}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-[var(--accent)]">{stats.open}</p>
                  <p className="text-xs text-muted-foreground/60">Open jobs</p>
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button asChild variant="secondary" className="rounded-full">
                  <Link href={`/clients/${client.id}`}>View details</Link>
                </Button>
                <DeleteClientButton clientId={client.id} />
              </div>
              <div className="mt-4 grid gap-2 text-xs text-muted-foreground/70">
                {client.email ? <p>{client.email}</p> : null}
                {client.phone ? <p>{client.phone}</p> : null}
                {client.address ? <p>{client.address}</p> : null}
              </div>
              <div className="mt-4 text-xs text-muted-foreground/60">
                {stats.total} total jobs · Created{' '}
                {client.created_at ? new Date(client.created_at).toLocaleDateString() : 'N/A'}
              </div>
            </div>
          );
        })}
        {clients.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-white/30 p-6 text-sm text-muted-foreground/70">
            No clients on file. Add a new client to get started.
          </p>
        ) : null}
      </section>
    </div>
  );
}
