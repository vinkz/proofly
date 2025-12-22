// src/app/(app)/jobs/new/page.tsx
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { CERTIFICATE_LABELS, CERTIFICATE_TYPES } from '@/types/certificates';
import { Card } from '@/components/ui/card';

export default function NewJobPage() {
  return (
    <div className="mx-auto max-w-2xl py-10">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-[var(--accent)]">Start a new job</p>
        <h1 className="text-3xl font-bold text-[var(--brand)]">Select a record type</h1>
        <p className="text-sm text-muted-foreground/80">
          Choose the type of certificate or record you need to create.
        </p>
      </div>
      <Card className="mt-6 space-y-3 border border-white/50 bg-white/95 p-4 shadow">
        {CERTIFICATE_TYPES.map((type) => (
          <Link
            key={type}
            href={`/wizard/create/${type}`}
            className="group flex w-full items-center justify-between rounded-2xl border border-white/30 bg-[var(--muted)]/60 px-4 py-3 text-left shadow-sm transition hover:border-[var(--accent)] hover:bg-white"
          >
            <div>
              <p className="text-sm font-semibold text-muted">{CERTIFICATE_LABELS[type]}</p>
              <p className="text-xs text-muted-foreground/70">Create a new {CERTIFICATE_LABELS[type]}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground/50 transition-transform group-hover:translate-x-1" />
          </Link>
        ))}
      </Card>
    </div>
  );
}