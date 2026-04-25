'use client';

import type { ReactNode } from 'react';

import { Input } from '@/components/ui/input';

type UnitNumberInputProps = {
  label: string;
  value: number | string;
  unit: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  note?: string;
  labelAction?: ReactNode;
};

export function UnitNumberInput({ label, value, unit, onChange, placeholder, disabled = false, note, labelAction }: UnitNumberInputProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">{label}</p>
        {labelAction}
      </div>
      <div className="relative">
        <Input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-16"
          disabled={disabled}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground/70">
          {unit}
        </span>
      </div>
      {note ? <p className="text-[11px] font-medium text-muted-foreground/70">{note}</p> : null}
    </div>
  );
}
