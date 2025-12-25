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
      className={`inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-muted-foreground/80 ${
        onClick ? 'bg-white/70 hover:bg-white/90' : 'bg-white/40'
      }`}
    >
      {text}
    </button>
  );
}
