'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type WizardDraftEnvelope<T> = {
  version: number;
  data: T;
  localUpdatedAt?: number;
  syncedAt?: number;
  syncedSnapshot?: string;
};

type UseWizardDraftOptions<T> = {
  storageKey: string;
  state: T;
  onRestore: (state: T) => void;
  syncState?: unknown;
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
  syncState,
  enabled = true,
  version = DEFAULT_VERSION,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseWizardDraftOptions<T>) {
  const restoreDraftRef = useRef(onRestore);
  const currentSnapshotRef = useRef('');
  const lastSyncedSnapshotRef = useRef<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false);
  const [localUpdatedAt, setLocalUpdatedAt] = useState<number | null>(null);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [restoredFromDraft, setRestoredFromDraft] = useState(false);
  const serializedSyncSnapshot = useMemo(
    () =>
      JSON.stringify({
        version,
        data: syncState ?? state,
      }),
    [state, syncState, version],
  );
  currentSnapshotRef.current = serializedSyncSnapshot;

  useEffect(() => {
    restoreDraftRef.current = onRestore;
  }, [onRestore]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateOnlineState = () => setIsOnline(window.navigator.onLine);
    updateOnlineState();
    window.addEventListener('online', updateOnlineState);
    window.addEventListener('offline', updateOnlineState);
    return () => {
      window.removeEventListener('online', updateOnlineState);
      window.removeEventListener('offline', updateOnlineState);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !storageKey || typeof window === 'undefined') {
      setIsReady(true);
      return;
    }

    try {
      const raw = window.localStorage.getItem(storageKey) ?? window.sessionStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as
          | WizardDraftEnvelope<T>
          | T
          | null;

        setRestoredFromDraft(true);
        if (
          parsed &&
          typeof parsed === 'object' &&
          'data' in parsed &&
          (!('version' in parsed) || parsed.version === version)
        ) {
          lastSyncedSnapshotRef.current = parsed.syncedSnapshot ?? null;
          setLocalUpdatedAt(parsed.localUpdatedAt ?? null);
          setSyncedAt(parsed.syncedAt ?? null);
          setHasUnsyncedChanges(Boolean((parsed.localUpdatedAt ?? 0) > (parsed.syncedAt ?? 0)));
          restoreDraftRef.current(parsed.data);
        } else if (parsed && typeof parsed === 'object') {
          setHasUnsyncedChanges(true);
          restoreDraftRef.current(parsed as T);
        }
      } else {
        const now = Date.now();
        lastSyncedSnapshotRef.current = currentSnapshotRef.current;
        setSyncedAt(now);
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
        const now = Date.now();
        const isSynced = lastSyncedSnapshotRef.current === serializedSyncSnapshot;
        const nextLocalUpdatedAt = isSynced ? syncedAt ?? now : now;
        const nextSyncedAt = isSynced ? syncedAt ?? nextLocalUpdatedAt : syncedAt ?? undefined;
        const envelope = {
          version,
          data: state,
          localUpdatedAt: nextLocalUpdatedAt,
          syncedAt: nextSyncedAt,
          syncedSnapshot: lastSyncedSnapshotRef.current ?? undefined,
        } satisfies WizardDraftEnvelope<T>;

        window.localStorage.setItem(storageKey, JSON.stringify(envelope));
        window.sessionStorage.removeItem(storageKey);
        setLocalUpdatedAt(nextLocalUpdatedAt);
        setSyncedAt(nextSyncedAt ?? null);
        setHasUnsyncedChanges(!isSynced);
      } catch {
        // Ignore storage quota/access issues.
      }
    }, debounceMs);

    return () => window.clearTimeout(timeoutId);
  }, [debounceMs, enabled, isReady, serializedSyncSnapshot, state, storageKey, syncedAt, version]);

  const markSynced = (stateOverride?: T, syncStateOverride?: unknown) => {
    if (!storageKey || typeof window === 'undefined') return;
    const now = Date.now();
    const data = stateOverride ?? state;
    const syncData = syncStateOverride ?? (stateOverride === undefined ? syncState ?? state : syncState ?? stateOverride);
    const snapshot = JSON.stringify({
      version,
      data: syncData,
    });
    lastSyncedSnapshotRef.current = snapshot;
    setLocalUpdatedAt(now);
    setSyncedAt(now);
    setHasUnsyncedChanges(false);

    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          version,
          data,
          localUpdatedAt: now,
          syncedAt: now,
          syncedSnapshot: snapshot,
        } satisfies WizardDraftEnvelope<T>),
      );
      window.sessionStorage.removeItem(storageKey);
    } catch {
      // Ignore storage quota/access issues.
    }
  };

  const clearDraft = () => {
    if (!storageKey || typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(storageKey);
      window.sessionStorage.removeItem(storageKey);
      setHasUnsyncedChanges(false);
      setLocalUpdatedAt(null);
      setSyncedAt(null);
    } catch {
      // Ignore storage quota/access issues.
    }
  };

  return {
    clearDraft,
    hasUnsyncedChanges,
    isOnline,
    isReady,
    localUpdatedAt,
    markSynced,
    restoredFromDraft,
    syncedAt,
  };
}
