import { listClients } from '@/server/clients';
import { ClientPicker, NewClientForm } from '@/components/job-wizard/client-step';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default async function ClientStepPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = typeof params?.q === 'string' ? params.q : '';
  const clients = await listClients(query);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 rounded-3xl border border-white/20 bg-white/80 p-6 shadow-xl shadow-slate-900/5 backdrop-blur">
      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-wide text-[var(--accent)]">Step 1</p>
        <h1 className="text-3xl font-semibold text-muted">Select or create client</h1>
        <p className="text-sm text-muted-foreground/70">
          Search your CRM or add a new client to start a job draft.
        </p>
      </div>

      <form className="flex flex-col gap-3 rounded-2xl border border-white/20 bg-white/70 p-4 md:flex-row" action="/jobs/new/client" method="get">
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

      <div className="grid gap-6 lg:grid-cols-[3fr,2fr]">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground/80">
            Recent clients
          </h2>
          <p className="text-xs text-muted-foreground/60">Tap a record to begin a job draft.</p>
          <div className="mt-4">
            <ClientPicker clients={clients} />
          </div>
        </div>
        <div className="rounded-2xl border border-white/20 bg-white/70 p-4 shadow-inner">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground/80">
            Add new client
          </h2>
          <p className="text-xs text-muted-foreground/60">
            We will create a draft job once the client is saved.
          </p>
          <div className="mt-4">
            <NewClientForm />
          </div>
        </div>
      </div>
    </div>
  );
}
