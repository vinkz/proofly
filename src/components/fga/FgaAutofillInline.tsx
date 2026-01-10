'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { FgaAutofillModal } from '@/components/fga/FgaAutofillModal';

type FgaValues = {
  co_ppm?: number;
  co2_pct?: number;
  o2_pct?: number;
  ratio?: number;
  flue_temp_c?: number;
  ambient_temp_c?: number;
  efficiency_pct?: number;
};

type Props = {
  jobId: string;
  applianceId?: string | null;
  readingSet: 'high' | 'low';
  onApply: (values: FgaValues) => void;
  label?: string;
};

export function FgaAutofillInline({ jobId, applianceId, readingSet, onApply, label }: Props) {
  const [open, setOpen] = useState(false);
  const containerClass = label ? 'flex flex-wrap items-center justify-between gap-2' : 'flex justify-end';

  return (
    <div className={containerClass}>
      {label ? <p className="text-sm font-semibold text-muted">{label}</p> : null}
      <Button type="button" variant="outline" className="rounded-full text-xs" onClick={() => setOpen(true)}>
        Add FGA Evidence (auto-fill)
      </Button>
      <FgaAutofillModal
        open={open}
        onOpenChange={setOpen}
        jobId={jobId}
        applianceId={applianceId ?? ''}
        readingSet={readingSet}
        onApplied={onApply}
      />
    </div>
  );
}
