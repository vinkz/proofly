'use client';

import Link from 'next/link';

interface LimitReachedModalProps {
  message: string;
  onDismiss: () => void;
}

export function LimitReachedModal({ message, onDismiss }: LimitReachedModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-8 pt-16 sm:items-center">
      <div className="absolute inset-0" onClick={onDismiss} aria-hidden />
      <div className="relative z-10 w-full max-w-sm rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-5 text-[var(--color-text-primary)]">
        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-amber-bg)]">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
            <path d="M9 2L16 14H2L9 2Z" stroke="var(--color-amber)" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
            <path d="M9 7V10" stroke="var(--color-amber)" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="9" cy="12.5" r="0.75" fill="var(--color-amber)" />
          </svg>
        </div>

        <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)]">Monthly limit reached</h2>
        <p className="mt-1.5 text-[13px] leading-[1.5] text-[var(--color-text-secondary)]">{message}</p>

        <div className="mt-5 flex flex-col gap-[8px]">
          <Link
            href="/billing"
            className="flex w-full items-center justify-center rounded-full bg-[var(--color-text-primary)] px-4 py-[9px] text-[13px] font-medium text-[var(--color-text-inverse)] transition-colors hover:opacity-90"
          >
            Upgrade now
          </Link>
          <button
            type="button"
            onClick={onDismiss}
            className="flex w-full items-center justify-center rounded-full border-[0.5px] border-[var(--color-border-secondary)] bg-transparent px-4 py-[9px] text-[13px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-background-tertiary)]"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
