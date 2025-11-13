import { notFound } from 'next/navigation';

import { getTemplate } from '@/server/templates';
import TemplateEditor from '@/components/templates/template-editor';
import { isUUID } from '@/lib/ids';

export default async function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isUUID(id)) {
      return notFound();
    }
    const template = await getTemplate(id);
    return (
      <main className="mx-auto max-w-3xl p-6">
        <TemplateEditor template={template} />
      </main>
    );
  } catch {
    notFound();
  }
}
