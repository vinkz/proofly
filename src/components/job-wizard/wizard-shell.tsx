import Link from 'next/link';
import type { ReactNode } from 'react';
import { clsx } from 'clsx';

import type { TemplateModel } from '@/types/template';
import type { ClientSummary } from '@/types/job-wizard';
import type { JobDetailPayload } from '@/types/job-detail';

const steps = [
  { id: 'client', label: 'Client' },
  { id: 'template', label: 'Certificate' },
  { id: 'details', label: 'Job details' },
  { id: 'inspection', label: 'Inspection' },
  { id: 'summary', label: 'Summary & signatures' },
  { id: 'ai', label: 'AI report' },
  { id: 'report', label: 'Report view' },
] as const;

export type WizardStep = (typeof steps)[number]['id'];

interface WizardShellProps {
  jobId: string;
  currentStep: WizardStep;
  job: JobDetailPayload['job'];
  client: ClientSummary | null;
  template: TemplateModel | null;
  children: ReactNode;
}

export function WizardShell({ jobId, currentStep, job, client, template, children }: WizardShellProps) {
  const currentIndex = steps.findIndex((step) => step.id === currentStep);
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 py-8">
      <header className="rounded-3xl border border-white/20 bg-white/60 px-6 py-5 shadow-lg shadow-slate-900/5 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">CertNow certificate flow</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {steps.map((step, index) => {
            const status = index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'upcoming';
            const href =
              step.id === 'client'
                ? '/jobs/new/client'
                : `/jobs/new/${jobId}/${step.id === 'ai' ? 'ai' : step.id}`;
            const content = (
              <span
                key={step.id}
                className={clsx(
                  'flex min-w-[120px] items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition',
                  {
                    'bg-[var(--accent)] text-white shadow-sm': status === 'current',
                    'bg-emerald-50 text-emerald-700': status === 'complete',
                    'bg-white/70 text-muted-foreground': status === 'upcoming',
                  },
                )}
              >
                <span
                  className={clsx(
                    'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                    {
                      'bg-white/30 text-white': status === 'current',
                      'bg-emerald-100 text-emerald-800': status === 'complete',
                      'bg-muted text-muted-foreground/80': status === 'upcoming',
                    },
                  )}
                >
                  {index + 1}
                </span>
                {step.label}
              </span>
            );

            if (status === 'complete') {
              return (
                <Link key={step.id} href={href} className="focus-visible:outline-accent">
                  {content}
                </Link>
              );
            }
            return (
              <div key={step.id} aria-current={status === 'current' ? 'step' : undefined}>
                {content}
              </div>
            );
          })}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <section className="rounded-3xl border border-white/10 bg-white/80 p-6 shadow-lg shadow-slate-900/5 backdrop-blur">
          {children}
        </section>
        <aside className="space-y-4">
          <InfoCard title="Client" description="Contact and site details">
            {client ? (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="text-base font-semibold text-muted">{client.name}</p>
                {client.organization ? <p>{client.organization}</p> : null}
                {client.email ? <p>{client.email}</p> : null}
                {client.phone ? <p>{client.phone}</p> : null}
                {client.address ? (
                  <p className="text-xs text-muted-foreground/70">{client.address}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/70">Select or create a client to continue.</p>
            )}
          </InfoCard>

          <InfoCard title="Certificate" description="Inspection blueprint">
            {template ? (
              <div className="space-y-1 text-sm text-muted-foreground">
                <p className="text-base font-semibold text-muted">{template.name}</p>
                <p>{template.items.length} checklist items</p>
                <p className="text-xs text-muted-foreground/70">
                  {template.is_public ? 'Public workflow' : 'My workflow'}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/70">Choose a workflow to generate the inspection flow.</p>
            )}
          </InfoCard>

          <InfoCard title="Job details" description="Scheduling & assignment">
            <dl className="space-y-2 text-sm text-muted-foreground">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground/60">Title</dt>
                <dd className="font-medium text-muted">{job.title ?? 'Add job title'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground/60">Scheduled</dt>
                <dd>{job.scheduled_for ? formatDate(job.scheduled_for) : 'Schedule visit'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground/60">Technician</dt>
                <dd>{job.technician_name || 'Assign technician'}</dd>
              </div>
            </dl>
          </InfoCard>
        </aside>
      </div>
    </div>
  );
}

interface InfoCardProps {
  title: string;
  description: string;
  children: ReactNode;
}

function InfoCard({ title, description, children }: InfoCardProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/70 p-5 shadow-sm shadow-slate-900/5 backdrop-blur">
      <p className="text-sm font-semibold text-muted">{title}</p>
      <p className="text-xs text-muted-foreground/70">{description}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    }).format(new Date(value));
  } catch {
    return value;
  }
}
