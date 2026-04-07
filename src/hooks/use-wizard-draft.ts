'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type WizardDraftEnvelope<T> = {
  version: number;
  data: T;
};

type UseWizardDraftOptions<T> = {
  storageKey: string;
  state: T;
  onRestore: (state: T) => void;
  enabled?: boolean;
  version?: number;
  debounceMs?: number;
};

const DEFAULT_VERSION = 1;
const DEFAULT_DEBOUNCE_MS = 150;

export function buildWizardDraftStorageKey(kind: string, jobId: string) {
  return `certnow:wizard-draft:${kind}:${jobId}`;
}

export function useWizardDraft<T>({
  storageKey,
  state,
  onRestore,
  enabled = true,
  version = DEFAULT_VERSION,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseWizardDraftOptions<T>) {
  const restoreDraftRef = useRef(onRestore);
  const [isReady, setIsReady] = useState(false);
  const serializedState = useMemo(
    () =>
      JSON.stringify({
        version,
        data: state,
      } satisfies WizardDraftEnvelope<T>),
    [state, version],
  );

  useEffect(() => {
    restoreDraftRef.current = onRestore;
  }, [onRestore]);

  useEffect(() => {
    if (!enabled || !storageKey || typeof window === 'undefined') {
      setIsReady(true);
      return;
    }

    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as
          | WizardDraftEnvelope<T>
          | T
          | null;

        if (
          parsed &&
          typeof parsed === 'object' &&
          'data' in parsed &&
          (!('version' in parsed) || parsed.version === version)
        ) {
          restoreDraftRef.current(parsed.data);
        } else if (parsed && typeof parsed === 'object') {
          restoreDraftRef.current(parsed as T);
        }
      }
    } catch {
      // Ignore broken or unavailable session drafts.
    }

    setIsReady(true);
  }, [enabled, storageKey, version]);

  useEffect(() => {
    if (!enabled || !isReady || !storageKey || typeof window === 'undefined') return;

    const timeoutId = window.setTimeout(() => {
      try {
        window.sessionStorage.setItem(storageKey, serializedState);
      } catch {
        // Ignore storage quota/access issues.
      }
    }, debounceMs);

    return () => window.clearTimeout(timeoutId);
  }, [debounceMs, enabled, isReady, serializedState, storageKey]);

  const clearDraft = () => {
    if (!storageKey || typeof window === 'undefined') return;
    try {
      window.sessionStorage.removeItem(storageKey);
    } catch {
      // Ignore storage quota/access issues.
    }
  };

  return { clearDraft, isReady };
}
