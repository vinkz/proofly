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
    <div className="space-y-[6px]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-[var(--color-text-secondary)]">{label}</p>
        {labelAction}
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1"
          disabled={disabled}
        />
        <span
          className="flex-shrink-0 text-[11px] text-[rgba(255,255,255,0.3)]"
          style={{ width: unit === 'mbar' ? 32 : 28 }}
        >
          {unit}
        </span>
      </div>
      {note ? <p className="text-[11px] text-[var(--color-text-tertiary)]">{note}</p> : null}
    </div>
  );
}
