'use client';

import { useDeferredValue, useEffect, useRef, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { AddressLookupResult, AddressLookupSuggestion } from '@/lib/address-lookup';

const MIN_QUERY_LENGTH = 3;
const SEARCH_DEBOUNCE_MS = 250;

type AddressLookupApiResponse = {
  suggestions?: AddressLookupSuggestion[];
  address?: AddressLookupResult;
  error?: string;
};

// Config/kill-switch responses mean "no lookup available" — fall back to silent manual entry.
const getLookupErrorMessage = (error: unknown, fallback: string) => {
  if (
    error instanceof Error &&
    ['Address lookup disabled', 'Address lookup is disabled', 'Address lookup is not configured'].includes(error.message)
  ) {
    return null;
  }
  return error instanceof Error ? error.message : fallback;
};

// Never show raw provider errors (e.g. the Ideal Postcodes 402 detail) in the UI.
// Pass through benign guidance, collapse everything else to a calm "enter manually" hint.
const formatLookupError = (msg: string | null) => {
  if (!msg) return null;
  if (msg.startsWith('Type at least') || msg === 'No addresses found. Try a postcode or add more detail.') {
    return msg;
  }
  return 'Address lookup unavailable — enter manually';
};

const defaultSelectionText = (address: AddressLookupResult) => address.line1 || address.label;

export type AddressAutocompleteFieldProps = {
  value: string;
  /** Called on every keystroke and with the selection text when a suggestion is picked. */
  onValueChange: (value: string) => void;
  /** Called after a suggestion resolves; set the sibling fields (line 2, city, postcode…) here. */
  onAddressSelect?: (address: AddressLookupResult) => void;
  /** What the field itself should contain after a selection. Defaults to line 1. */
  getSelectionText?: (address: AddressLookupResult) => string;
  /** 'input' = ui <Input>, 'bare' = unstyled <input> (host supplies classes), 'textarea' = ui <Textarea>. */
  variant?: 'input' | 'bare' | 'textarea';
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  autoComplete?: string;
  className?: string;
  inputClassName?: string;
};

export function AddressAutocompleteField({
  value,
  onValueChange,
  onAddressSelect,
  getSelectionText = defaultSelectionText,
  variant = 'input',
  placeholder,
  disabled,
  required,
  name,
  id,
  autoComplete = 'off',
  className,
  inputClassName,
}: AddressAutocompleteFieldProps) {
  const [suggestions, setSuggestions] = useState<AddressLookupSuggestion[]>([]);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLookupPending, setIsLookupPending] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  // Set to the field text produced by a selection so the effect below doesn't
  // immediately re-open the dropdown for the address the user just picked.
  const suppressedQueryRef = useRef<string | null>(null);

  const deferredQuery = useDeferredValue(value.trim());

  useEffect(() => {
    if (suppressedQueryRef.current !== null) {
      if (deferredQuery === suppressedQueryRef.current) return;
      suppressedQueryRef.current = null;
    }

    if (!deferredQuery) {
      setSuggestions([]);
      setSelectedMatchId(null);
      setLookupError(null);
      setIsLookupPending(false);
      return;
    }

    if (deferredQuery.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setSelectedMatchId(null);
      setLookupError(`Type at least ${MIN_QUERY_LENGTH} characters to search.`);
      setIsLookupPending(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsLookupPending(true);
      setLookupError(null);
      try {
        const response = await fetch(`/api/address-search?q=${encodeURIComponent(deferredQuery)}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as AddressLookupApiResponse;
        if (!response.ok) throw new Error(payload.error || 'Lookup failed');
        const nextSuggestions = payload.suggestions ?? [];
        setSuggestions(nextSuggestions);
        setSelectedMatchId(null);
        setLookupError(nextSuggestions.length ? null : 'No addresses found. Try a postcode or add more detail.');
      } catch (searchError) {
        if (controller.signal.aborted) return;
        setSuggestions([]);
        setSelectedMatchId(null);
        setLookupError(getLookupErrorMessage(searchError, 'Try another search.'));
      } finally {
        if (!controller.signal.aborted) setIsLookupPending(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [deferredQuery]);

  const handleSelect = async (suggestion: AddressLookupSuggestion) => {
    setIsLookupPending(true);
    setSelectedMatchId(suggestion.id);
    setLookupError(null);
    try {
      const response = await fetch(`/api/address-search?id=${encodeURIComponent(suggestion.id)}`);
      const payload = (await response.json()) as AddressLookupApiResponse;
      if (!response.ok || !payload.address) throw new Error(payload.error || 'Lookup failed');
      const address = payload.address;
      const selectionText = (getSelectionText(address) || suggestion.label).trim();
      suppressedQueryRef.current = selectionText;
      onValueChange(selectionText);
      onAddressSelect?.(address);
      setSuggestions([]);
    } catch (selectError) {
      setSelectedMatchId(null);
      setLookupError(getLookupErrorMessage(selectError, 'Try again.'));
    } finally {
      setIsLookupPending(false);
    }
  };

  const fieldProps = {
    value,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onValueChange(event.target.value);
      setLookupError(null);
      setSelectedMatchId(null);
    },
    placeholder,
    disabled,
    required,
    name,
    id,
    autoComplete,
    className: inputClassName,
  };

  return (
    <div className={`relative ${className ?? ''}`}>
      {variant === 'textarea' ? (
        <Textarea {...fieldProps} />
      ) : variant === 'bare' ? (
        <input {...(fieldProps as React.InputHTMLAttributes<HTMLInputElement>)} />
      ) : (
        <Input {...(fieldProps as React.InputHTMLAttributes<HTMLInputElement>)} />
      )}
      {isLookupPending && !suggestions.length ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-[10px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2 text-[13px] text-[var(--color-text-secondary)] shadow-sm">
          Searching addresses…
        </div>
      ) : null}
      {suggestions.length ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-[10px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-sm">
          <div className="max-h-60 overflow-y-auto p-1.5">
            {suggestions.map((suggestion) => {
              const isSelected = selectedMatchId === suggestion.id;
              return (
                <button
                  key={suggestion.id}
                  type="button"
                  onClick={() => void handleSelect(suggestion)}
                  className={`w-full rounded-[8px] px-3 py-2 text-left text-[13px] transition-colors ${
                    isSelected
                      ? 'bg-[var(--color-action-bg)] text-[var(--color-action)]'
                      : 'text-[var(--color-text-primary)] hover:bg-[var(--color-background-tertiary)]'
                  }`}
                >
                  {suggestion.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {lookupError ? (
        <p className="mt-1.5 text-[12px] text-[var(--color-text-tertiary)]">{formatLookupError(lookupError)}</p>
      ) : null}
    </div>
  );
}

export const composeAddressText = (...parts: Array<string | null | undefined>) =>
  parts
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(', ');
