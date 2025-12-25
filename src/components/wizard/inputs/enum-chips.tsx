'use client';

import { Button } from '@/components/ui/button';

export type EnumChipOption = {
  label: string;
  value: string;
};

type EnumChipsProps = {
  label: string;
  value: string;
  options: EnumChipOption[];
  onChange: (value: string) => void;
};

export function EnumChips({ label, value, options, onChange }: EnumChipsProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isActive = value === option.value;
          return (
            <Button
              key={option.value}
              type="button"
              variant={isActive ? 'primary' : 'outline'}
              className="rounded-full px-3 py-1 text-xs"
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
