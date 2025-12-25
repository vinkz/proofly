'use client';

import { Button } from '@/components/ui/button';

export type PassFailValue = 'pass' | 'fail' | null;

type PassFailToggleProps = {
  label: string;
  value: PassFailValue;
  onChange: (value: PassFailValue) => void;
};

export function PassFailToggle({ label, value, onChange }: PassFailToggleProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">{label}</p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant={value === 'pass' ? 'primary' : 'outline'}
          className="rounded-full px-4 py-1 text-xs"
          onClick={() => onChange('pass')}
        >
          Pass
        </Button>
        <Button
          type="button"
          variant={value === 'fail' ? 'primary' : 'outline'}
          className="rounded-full px-4 py-1 text-xs"
          onClick={() => onChange('fail')}
        >
          Fail
        </Button>
      </div>
    </div>
  );
}
