'use client';

/**
 * Address autocomplete backed by /api/address-search (Ideal Postcodes).
 *
 * Every keystroke past the minimum bills the provider key, so the query is
 * debounced and short queries never leave the browser. The endpoint is already
 * public — the landlord booking page uses it — and carries its own per-IP cap
 * and a kill switch.
 *
 * Degrades to nothing. If lookup is disabled, unconfigured, out of balance or
 * rate limited, this stops trying and says so quietly; the manual address
 * fields below it are always present and always authoritative. An engineer in a
 * basement with no signal must still be able to finish the certificate.
 */
import { useEffect, useId, useRef, useState } from 'react';

import { Input } from '@/components/ui/input';
import type { AddressLookupResult, AddressLookupSuggestion } from '@/lib/address-lookup';

const MIN_QUERY = 3;
const DEBOUNCE_MS = 250;

type Props = {
  label: string;
  hint?: string;
  onSelect: (address: AddressLookupResult) => void;
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
};

export function AddressLookupField({
  label,
  hint,
  onSelect,
  value,
  onValueChange,
  placeholder = 'Start typing a postcode or address',
  autoComplete = 'off',
}: Props) {
  const [internalQuery, setInternalQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AddressLookupSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  /** Once the provider is unavailable, stop asking for the rest of the visit. */
  const [disabled, setDisabled] = useState(false);
  const listId = useId();
  const boxRef = useRef<HTMLDivElement | null>(null);
  const skipSearchForRef = useRef<string | null>(null);
  /**
   * Set whenever the user closes the list themselves — clicking away, Escape,
   * tabbing out, or picking a suggestion. A search is debounced and then has to
   * cross the network, so it routinely resolves *after* one of those, and
   * without this the list reopens on its own a moment after being dismissed.
   * Cleared on the next keystroke, which is the user asking for it again.
   */
  const dismissedRef = useRef(false);
  const query = value ?? internalQuery;
  const isManualAddressInput = value !== undefined || onValueChange !== undefined;
  const manualEntryNote = isManualAddressInput
    ? 'Continue entering the address manually.'
    : 'Type the address in the fields below.';

  const dismiss = () => {
    dismissedRef.current = true;
    setOpen(false);
    setActiveIndex(-1);
  };

  const updateQuery = (nextValue: string) => {
    // Typing is a request to see matches again.
    dismissedRef.current = false;
    if (value === undefined) setInternalQuery(nextValue);
    onValueChange?.(nextValue);
    setActiveIndex(-1);
  };

  useEffect(() => {
    // pointerdown, not mousedown: this is a mobile-first form, and a tap does
    // not reliably produce a mouse event before the list has been scrolled or
    // the next field focused.
    const onDocPointerDown = (event: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) dismiss();
    };
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, []);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    // Tabbing out left the list open on top of the field the user had moved to.
    // Ignore focus moving *within* the widget.
    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget as Node | null;
      if (next && box.contains(next)) return;
      dismiss();
    };
    box.addEventListener('focusout', onFocusOut);
    return () => box.removeEventListener('focusout', onFocusOut);
  }, []);

  useEffect(() => {
    if (disabled) return;
    const trimmed = query.trim();
    if (skipSearchForRef.current === trimmed) {
      skipSearchForRef.current = null;
      setSuggestions([]);
      setOpen(false);
      return;
    }
    if (trimmed.length < MIN_QUERY) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setBusy(true);
      try {
        const response = await fetch(`/api/address-search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          // 401/403 disabled, 500 unconfigured, 402 balance, 429 rate limited — all
          // mean "stop asking and let them type".
          setDisabled([401, 402, 403, 429, 500].includes(response.status));
          setSuggestions([]);
          setNote(`Address lookup is unavailable. ${manualEntryNote}`);
          return;
        }
        const data = (await response.json()) as { suggestions?: AddressLookupSuggestion[] };
        const list = data.suggestions ?? [];
        setSuggestions(list);
        // Never reopen a list the user has already closed — this response is
        // older than their dismissal.
        setOpen(!dismissedRef.current && list.length > 0);
        setNote(list.length === 0 ? `No matches. ${manualEntryNote}` : null);
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        setNote(`Address lookup is unavailable. ${manualEntryNote}`);
      } finally {
        setBusy(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, disabled, manualEntryNote]);

  const choose = async (suggestion: AddressLookupSuggestion) => {
    dismiss();
    setBusy(true);
    try {
      const response = await fetch(`/api/address-search?id=${encodeURIComponent(suggestion.id)}`);
      if (!response.ok) {
        setNote(`Could not load that address. ${manualEntryNote}`);
        return;
      }
      const data = (await response.json()) as { address?: AddressLookupResult };
      if (data.address) {
        const resolvedLine1 =
          data.address.line1 || data.address.summary || suggestion.address || suggestion.label;
        skipSearchForRef.current = resolvedLine1.trim();
        setSuggestions([]);
        updateQuery(resolvedLine1);
        // updateQuery treats input as "show me matches"; here the value came
        // from a pick, so keep it dismissed.
        dismissedRef.current = true;
        onSelect(data.address);
        setNote(null);
      }
    } catch {
      setNote(`Could not load that address. ${manualEntryNote}`);
    } finally {
      setBusy(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestions.length) {
      if (event.key === 'Escape') dismiss();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      dismissedRef.current = false;
      setOpen(true);
      setActiveIndex((current) => (current + 1) % suggestions.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      dismissedRef.current = false;
      setOpen(true);
      setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
      return;
    }
    if (event.key === 'Enter' && open && activeIndex >= 0) {
      event.preventDefault();
      void choose(suggestions[activeIndex]);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      dismiss();
    }
  };

  // Hide a dead control — but never yank it out from under someone mid-word.
  // Once they have typed, keep it and explain, so what they typed stays on
  // screen and they can see why nothing is happening.
  if (disabled && !isManualAddressInput && !suggestions.length && !query.trim()) {
    return null;
  }

  return (
    <div ref={boxRef} className="relative">
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-[var(--color-text-secondary)]">
          {label}
        </span>
        <Input
          value={query}
          onChange={(e) => updateQuery(e.target.value)}
          onFocus={() => setOpen(!dismissedRef.current && suggestions.length > 0)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete={autoComplete}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={
            open && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
          }
        />
      </label>
      {hint && !note ? (
        <span className="mt-1 block text-[12px] text-[var(--color-text-tertiary)]">{hint}</span>
      ) : null}
      <span aria-live="polite" aria-atomic="true">
        {busy ? (
          <span className="mt-1 block text-[12px] text-[var(--color-text-tertiary)]">Searching…</span>
        ) : null}
        {note ? (
          <span className="mt-1 block text-[12px] text-[var(--color-text-tertiary)]">{note}</span>
        ) : null}
      </span>

      {open && suggestions.length ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-[240px] w-full overflow-auto rounded-[12px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-lg"
        >
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.id} role="none">
              <button
                id={`${listId}-option-${index}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                // Keep focus in the input. Safari does not focus a button on
                // click, so without this the focusout handler fires first and
                // closes the list before onClick can pick the address.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(suggestion)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`block w-full px-3 py-2.5 text-left text-[13px] text-[var(--color-text-primary)] transition-colors ${
                  index === activeIndex ? 'bg-[var(--color-background-secondary)]' : 'hover:bg-[var(--color-background-secondary)]'
                }`}
              >
                {suggestion.label || suggestion.address}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
