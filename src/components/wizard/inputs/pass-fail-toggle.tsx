'use client';

export type PassFailValue = 'pass' | 'fail' | null;

type PassFailToggleProps = {
  label: string;
  value: PassFailValue;
  onChange: (value: PassFailValue) => void;
};

const PASS_SELECTED = {
  background: '#0a3d26',
  color: '#5DCAA5',
  border: '0.5px solid #1D9E75',
  fontWeight: 500,
} as const;

const FAIL_SELECTED = {
  background: '#3d0a0a',
  color: '#F09595',
  border: '0.5px solid #A32D2D',
  fontWeight: 500,
} as const;

const UNSELECTED = {
  background: 'var(--color-background-tertiary)',
  color: 'var(--color-text-secondary)',
  border: '1px solid var(--color-border-primary)',
  fontWeight: 400,
} as const;

export function PassFailToggle({ label, value, onChange }: PassFailToggleProps) {
  return (
    <div className="space-y-[6px]">
      <p className="text-[13px] font-medium text-[var(--color-text-secondary)]">{label}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange('pass')}
          style={{
            minWidth: 72,
            height: 36,
            borderRadius: 20,
            fontSize: 12,
            ...(value === 'pass' ? PASS_SELECTED : UNSELECTED),
          }}
        >
          Pass
        </button>
        <button
          type="button"
          onClick={() => onChange('fail')}
          style={{
            minWidth: 72,
            height: 36,
            borderRadius: 20,
            fontSize: 12,
            ...(value === 'fail' ? FAIL_SELECTED : UNSELECTED),
          }}
        >
          Fail
        </button>
      </div>
    </div>
  );
}
