import { listClients } from '@/server/clients';
import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { DeleteClientButton } from '@/components/clients/delete-client-button';
import { Button } from '@/components/ui/button';

export default async function ClientsPage() {
  const clients = await listClients();
  const supabase = await supabaseServerReadOnly();
  const { data: jobs } = clients.length
    ? await supabase
        .from('jobs')
        .select('client_id, status')
        .in(
          'client_id',
          clients.map((client) => client.id),
        )
    : { data: [] };
  const jobStats = (jobs ?? []).reduce<Record<string, { open: number; total: number }>>((acc, job) => {
    const key = job.client_id ?? '';
    if (!key) return acc;
    acc[key] = acc[key]
      ? {
          open: acc[key].open + (job.status === 'completed' ? 0 : 1),
          total: acc[key].total + 1,
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
          <a href="/jobs/new/client">New client job</a>
        </Button>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {clients.map((client) => {
          const stats = jobStats[client.id] ?? { open: 0, total: 0 };
          return (
            <a
              key={client.id}
              href={`/clients/${client.id}`}
              className="group rounded-3xl border border-white/20 bg-white/80 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold text-muted">{client.name}</p>
                  <p className="text-xs text-muted-foreground/60">{client.organization ?? 'Individual'}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-[var(--accent)]">{stats.open}</p>
                  <p className="text-xs text-muted-foreground/60">Open jobs</p>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <div onClick={(e) => e.preventDefault()}>
                  <DeleteClientButton clientId={client.id} />
                </div>
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
            </a>
          );
        })}
        {clients.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-white/30 p-6 text-sm text-muted-foreground/70">
            No clients on file. Add one from the job wizard to get started.
          </p>
        ) : null}
      </section>
    </div>
  );
}
