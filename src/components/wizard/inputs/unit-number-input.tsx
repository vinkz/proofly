'use client';

import { Input } from '@/components/ui/input';

type UnitNumberInputProps = {
  label: string;
  value: number | string;
  unit: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function UnitNumberInput({ label, value, unit, onChange, placeholder }: UnitNumberInputProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">{label}</p>
      <div className="relative">
        <Input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-16"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground/70">
          {unit}
        </span>
      </div>
    </div>
  );
}
