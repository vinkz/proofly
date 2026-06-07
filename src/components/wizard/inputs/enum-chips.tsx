'use client';

import type { CSSProperties } from 'react';

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

function chipStyle(optionValue: string, isActive: boolean): CSSProperties {
  if (!isActive) {
    return {
      background: 'var(--color-background-tertiary)',
      color: 'var(--color-text-secondary)',
      border: '1px solid var(--color-border-primary)',
      fontWeight: 400,
    };
  }
  const v = optionValue.toLowerCase();
  if (v === 'yes' || v === 'pass' || v === 'safe') {
    return { background: '#0a3d26', color: '#5DCAA5', border: '0.5px solid #1D9E75', fontWeight: 500 };
  }
  if (v === 'no' || v === 'fail' || v === 'id') {
    return { background: '#3d0a0a', color: '#F09595', border: '0.5px solid #A32D2D', fontWeight: 500 };
  }
  if (v === 'ncs' || v === 'ar') {
    return { background: '#3d2a00', color: '#EF9F27', border: '0.5px solid #BA7517', fontWeight: 500 };
  }
  // Default selected: green (appliance type chips, etc.)
  return { background: '#0a3d26', color: '#5DCAA5', border: '0.5px solid #1D9E75', fontWeight: 500 };
}

export function EnumChips({ label, value, options, onChange }: EnumChipsProps) {
  return (
    <div className="space-y-[6px]">
      <p className="text-[13px] font-medium text-[var(--color-text-secondary)]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isActive = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              style={{
                padding: '7px 18px',
                borderRadius: 20,
                fontSize: 12,
                ...chipStyle(option.value, isActive),
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
