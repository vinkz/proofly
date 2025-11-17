import Link from 'next/link';

import { listVisibleTemplates } from '@/server/templates';
import NewTemplateButton from '@/components/templates/new-template-button';
import { DuplicateTemplateInline } from '@/components/templates/duplicate-template-inline';

export default async function TemplatesPage() {
  const templates = await listVisibleTemplates('plumbing');
  const myTemplates = templates.filter((template) => !template.is_public);
  const publicTemplates = templates.filter((template) => template.is_public);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--accent)]">Template library</p>
          <h1 className="text-3xl font-semibold text-muted">Templates</h1>
          <p className="text-sm text-muted-foreground/70">Build reusable inspection checklists for every trade.</p>
        </div>
        <NewTemplateButton />
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-muted">My templates</h2>
          <p className="text-xs text-muted-foreground/60">Editable templates only visible to your team.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {myTemplates.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
          {myTemplates.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-white/30 p-6 text-sm text-muted-foreground/70">
              No templates yet — duplicate a public template to get started.
            </p>
          ) : null}
        </div>
      </section>

      <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-muted">Public templates</h2>
                <p className="text-xs text-muted-foreground/60">Copy Proofly best-practice templates.</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {publicTemplates.map((template) => (
                <TemplateCard key={template.id} template={template} showDuplicate />
              ))}
              {publicTemplates.length === 0 ? (
                <p className="rounded-3xl border border-dashed border-white/30 p-6 text-sm text-muted-foreground/70">
                  No public templates available.
                </p>
              ) : null}
            </div>
      </section>
    </main>
  );
}

function TemplateCard({
  template,
  showDuplicate,
}: {
  template: Awaited<ReturnType<typeof listVisibleTemplates>>[number];
  showDuplicate?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-white/20 bg-white/80 p-5 shadow-sm">
      <Link href={`/templates/${template.id}`} className="block">
        <p className="text-lg font-semibold text-muted">{template.name}</p>
        <p className="text-xs text-muted-foreground/60">{template.trade_type}</p>
        <p className="mt-2 text-sm text-muted-foreground/80">{template.items.length} checklist items</p>
      </Link>
      {showDuplicate ? (
        <div className="mt-3">
          <DuplicateTemplateInline templateId={template.id} />
        </div>
      ) : null}
    </div>
  );
}
