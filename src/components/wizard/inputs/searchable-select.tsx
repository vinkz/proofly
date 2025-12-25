'use client';

import { useId, useRef } from 'react';

import { Input } from '@/components/ui/input';

export type SearchableSelectOption = {
  label: string;
  value: string;
};

type SearchableSelectProps = {
  label: string;
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
};

export function SearchableSelect({ label, value, options, onChange, placeholder }: SearchableSelectProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previousValueRef = useRef<string>('');
  const restoreOnBlurRef = useRef(false);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">{label}</p>
      <Input
        ref={inputRef}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => {
          if (value.trim()) {
            previousValueRef.current = value;
            restoreOnBlurRef.current = true;
            onChange('');
          }
          inputRef.current?.select();
        }}
        onClick={() => {
          if (value.trim()) {
            previousValueRef.current = value;
            restoreOnBlurRef.current = true;
            onChange('');
          }
          inputRef.current?.select();
        }}
        onBlur={() => {
          if (!restoreOnBlurRef.current) return;
          restoreOnBlurRef.current = false;
          if (!value.trim()) {
            onChange(previousValueRef.current);
          }
        }}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </datalist>
    </div>
  );
}
