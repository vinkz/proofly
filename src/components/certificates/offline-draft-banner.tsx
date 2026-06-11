'use client';

type OfflineDraftBannerProps = {
  hasUnsyncedChanges: boolean;
  isOnline: boolean;
  isSyncing?: boolean;
  lastSavedAt?: number | null;
  syncError?: string | null;
  syncErrorCount?: number;
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
  syncErrorCount = 0,
}: OfflineDraftBannerProps) {
  if (isOnline && !hasUnsyncedChanges && !isSyncing && !syncError) return null;

  const savedTime = formatSavedTime(lastSavedAt);
  const showAttention = Boolean(syncError && syncErrorCount >= 2);
  const status = showAttention ? 'Sync needs attention' : isSyncing ? 'Syncing' : 'Saved on this device';
  const savedCopy = `Changes are saved on this device${savedTime ? ` at ${savedTime}` : ''}.`;
  const message = showAttention
    ? syncError
    : isSyncing
      ? 'Syncing automatically to CertNow.'
      : !isOnline
        ? `${savedCopy} Syncs automatically when you are back online.`
        : `${savedCopy} Syncs automatically.`;

  return (
    <div
      className={`rounded-[12px] border-[0.5px] px-3 py-2 text-[12px] ${
        showAttention
          ? 'border-[var(--color-amber)]/40 bg-[var(--color-amber-bg)] text-[var(--color-text-primary)]'
          : 'border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)]'
      }`}
      role="status"
    >
      <div className="flex items-start gap-2">
        <span
          className={`mt-1 size-2 shrink-0 rounded-full ${
            showAttention ? 'bg-[var(--color-amber)]' : isOnline ? 'bg-[var(--color-action)]' : 'bg-[var(--color-text-tertiary)]'
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
