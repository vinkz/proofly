'use client';

type OfflineDraftBannerProps = {
  hasUnsyncedChanges: boolean;
  isOnline: boolean;
  isSyncing?: boolean;
  lastSavedAt?: number | null;
  syncError?: string | null;
};

const formatSavedTime = (value?: number | null) => {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return null;
  }
};

export function OfflineDraftBanner({
  hasUnsyncedChanges,
  isOnline,
  isSyncing = false,
  lastSavedAt,
  syncError,
}: OfflineDraftBannerProps) {
  if (isOnline && !hasUnsyncedChanges && !isSyncing && !syncError) return null;

  const savedTime = formatSavedTime(lastSavedAt);
  const status = !isOnline
    ? 'Offline'
    : isSyncing
      ? 'Syncing'
      : syncError
        ? 'Sync failed'
        : 'Not synced';
  const message = !isOnline
    ? `Changes are saved on this device${savedTime ? ` at ${savedTime}` : ''}. They will sync when you are back online.`
    : isSyncing
      ? 'Saving your offline draft to CertNow.'
      : syncError
        ? syncError
        : `Changes are saved on this device${savedTime ? ` at ${savedTime}` : ''}.`;

  return (
    <div
      className={`rounded-[12px] border-[0.5px] px-3 py-2 text-[12px] ${
        syncError
          ? 'border-[var(--color-red)]/30 bg-[var(--color-red-bg)] text-[var(--color-red)]'
          : 'border-[var(--color-amber)]/30 bg-[var(--color-amber-bg)] text-[var(--color-text-secondary)]'
      }`}
      role="status"
    >
      <div className="flex items-start gap-2">
        <span
          className={`mt-1 size-2 shrink-0 rounded-full ${
            syncError ? 'bg-[var(--color-red)]' : isOnline ? 'bg-[var(--color-amber)]' : 'bg-[var(--color-text-tertiary)]'
          }`}
          aria-hidden="true"
        />
        <div>
          <p className="font-medium">{status}</p>
          <p className="mt-0.5 text-[11px] opacity-80">{message}</p>
        </div>
      </div>
    </div>
  );
}
