'use client';

import { useEffect, useId, useRef, useState } from 'react';

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
  // While focused we show a local draft so the field can be blanked to reveal the
  // full datalist WITHOUT clearing the committed `value`. Clearing the committed
  // value used to cascade into the parent (e.g. wiping the selected make, which
  // collapsed the dependent model dropdown). The draft keeps focus behaviour local.
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(value);

  // Keep the draft in sync when the committed value changes from outside while the
  // field is idle (e.g. make is cleared because the appliance type switched catalogs).
  useEffect(() => {
    if (!focused) setDraft(value);
  }, [value, focused]);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground/70">{label}</p>
      <Input
        ref={inputRef}
        list={listId}
        value={focused ? draft : value}
        onChange={(e) => {
          setDraft(e.target.value);
          onChange(e.target.value);
        }}
        placeholder={placeholder}
        onFocus={() => {
          setFocused(true);
          // Blank the visible text so the datalist shows every option, but leave the
          // committed value untouched until the user actually picks/types something.
          setDraft('');
          inputRef.current?.select();
        }}
        onBlur={() => {
          setFocused(false);
          // Nothing chosen — restore the display to the committed value.
          if (!draft.trim()) setDraft(value);
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
