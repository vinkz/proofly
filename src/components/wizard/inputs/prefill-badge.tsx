'use client';

type PrefillBadgeProps = {
  text: string;
  onClick?: () => void;
};

export function PrefillBadge({ text, onClick }: PrefillBadgeProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border-[0.5px] border-[var(--color-border-secondary)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)] ${
        onClick
          ? 'bg-[var(--color-background-primary)] hover:bg-[var(--color-background-secondary)]'
          : 'bg-[var(--color-background-secondary)]'
      }`}
    >
      {text}
    </button>
  );
}
