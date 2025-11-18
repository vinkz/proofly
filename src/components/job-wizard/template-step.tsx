'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import type { TemplateModel } from '@/types/template';
import { setJobTemplate } from '@/server/jobs';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';

interface TemplateSectionProps {
  jobId: string;
  label: string;
  templates: TemplateModel[];
}

export function TemplateSection({ jobId, label, templates }: TemplateSectionProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleSelect = (templateId: string) => {
    startTransition(async () => {
      try {
        await setJobTemplate(jobId, templateId);
        pushToast({ title: 'Template attached', variant: 'success' });
        router.push(`/jobs/new/${jobId}/details`);
      } catch (error) {
        pushToast({
          title: 'Unable to attach template',
          description: error instanceof Error ? error.message : 'Try again shortly.',
          variant: 'error',
        });
      }
    });
  };

  return (
    <section className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-muted">{label.replace('Template', 'Workflow')}</p>
        <p className="text-xs text-muted-foreground/70">Select to generate a checklist.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((template) => (
          <div key={template.id} className="rounded-2xl border border-white/20 bg-white/60 p-4 shadow-sm">
            <p className="text-lg font-semibold text-muted">{template.name}</p>
            <p className="text-xs text-muted-foreground/60">
              {template.items.length} items · {template.trade_type}
            </p>
            <p className="mt-2 text-sm text-muted-foreground/80">
              {template.is_public ? 'Proofly public template' : 'My template'}
            </p>
            <Button
              type="button"
              className="mt-4 w-full"
              onClick={() => handleSelect(template.id)}
              disabled={isPending}
            >
              {isPending ? 'Applying…' : 'Use template'}
            </Button>
          </div>
        ))}
        {templates.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/30 p-6 text-sm text-muted-foreground/70">
            No templates available in this category.
          </p>
        ) : null}
      </div>
    </section>
  );
}
