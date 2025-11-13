import Link from 'next/link';

import { listVisibleTemplates } from '@/server/templates';
import NewTemplateButton from '@/components/templates/new-template-button';

export default async function TemplatesPage() {
  const templates = await listVisibleTemplates('plumbing');

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Templates</h1>
        <NewTemplateButton />
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {templates.map((template) => (
          <Link
            key={template.id}
            href={`/templates/${template.id}`}
            className="rounded border p-4 transition hover:bg-gray-50"
          >
            <div className="font-medium">{template.name}</div>
            <div className="mt-1 text-xs text-gray-500">
              {template.is_public ? 'Public' : 'My template'} · {template.trade_type}
            </div>
            <div className="mt-2 text-sm text-gray-500">{template.items.length} items</div>
          </Link>
        ))}
        {templates.length === 0 ? (
          <p className="rounded border border-dashed p-4 text-sm text-gray-500">No templates yet.</p>
        ) : null}
      </div>
    </main>
  );
}
