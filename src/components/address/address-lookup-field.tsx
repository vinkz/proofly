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
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  /** Once the provider is unavailable, stop asking for the rest of the visit. */
  const [disabled, setDisabled] = useState(false);
  const listId = useId();
  const boxRef = useRef<HTMLDivElement | null>(null);
  const skipSearchForRef = useRef<string | null>(null);
  const query = value ?? internalQuery;
  const isManualAddressInput = value !== undefined || onValueChange !== undefined;

  const updateQuery = (nextValue: string) => {
    if (value === undefined) setInternalQuery(nextValue);
    onValueChange?.(nextValue);
  };

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
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
          // 403 disabled, 500 unconfigured, 402 balance, 429 rate limited — all
          // mean "stop asking and let them type".
          setDisabled(response.status === 403 || response.status === 500);
          setSuggestions([]);
          setNote('Address lookup is unavailable — type the address below.');
          return;
        }
        const data = (await response.json()) as { suggestions?: AddressLookupSuggestion[] };
        setSuggestions(data.suggestions ?? []);
        setOpen((data.suggestions ?? []).length > 0);
        setNote((data.suggestions ?? []).length === 0 ? 'No matches — type the address below.' : null);
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        setNote('Address lookup is unavailable — type the address below.');
      } finally {
        setBusy(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, disabled]);

  const choose = async (suggestion: AddressLookupSuggestion) => {
    setOpen(false);
    setBusy(true);
    try {
      const response = await fetch(`/api/address-search?id=${encodeURIComponent(suggestion.id)}`);
      if (!response.ok) {
        setNote('Could not load that address — type it below.');
        return;
      }
      const data = (await response.json()) as { address?: AddressLookupResult };
      if (data.address) {
        const resolvedLine1 =
          data.address.line1 || data.address.summary || suggestion.address || suggestion.label;
        skipSearchForRef.current = resolvedLine1.trim();
        setSuggestions([]);
        updateQuery(resolvedLine1);
        onSelect(data.address);
        setNote(null);
      }
    } catch {
      setNote('Could not load that address — type it below.');
    } finally {
      setBusy(false);
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
          onFocus={() => setOpen(suggestions.length > 0)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-expanded={open}
          aria-controls={listId}
        />
      </label>
      {hint && !note ? (
        <span className="mt-1 block text-[12px] text-[var(--color-text-tertiary)]">{hint}</span>
      ) : null}
      {busy ? (
        <span className="mt-1 block text-[12px] text-[var(--color-text-tertiary)]">Searching…</span>
      ) : null}
      {note ? (
        <span className="mt-1 block text-[12px] text-[var(--color-text-tertiary)]">{note}</span>
      ) : null}

      {open && suggestions.length ? (
        <ul
          id={listId}
          className="absolute z-20 mt-1 max-h-[240px] w-full overflow-auto rounded-[12px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-lg"
        >
          {suggestions.map((suggestion) => (
            <li key={suggestion.id}>
              <button
                type="button"
                onClick={() => choose(suggestion)}
                className="block w-full px-3 py-2.5 text-left text-[13px] text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-background-secondary)]"
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
