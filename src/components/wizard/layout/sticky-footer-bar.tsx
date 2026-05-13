type StickyFooterBarProps = {
  leftContent?: React.ReactNode;
  rightAction: React.ReactNode;
  disabled?: boolean;
  hint?: string;
};

export function StickyFooterBar({
  leftContent,
  rightAction,
  disabled,
  hint,
}: StickyFooterBarProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30">
      <div className="pointer-events-auto mx-auto flex w-full max-w-2xl items-center justify-between gap-4 border-t-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-4 py-3">
        <div className="text-[13px] text-[var(--color-text-secondary)]">
          {leftContent}
          {hint ? <span className="ml-2 text-[var(--color-text-tertiary)]">{hint}</span> : null}
        </div>
        <div className={disabled ? 'opacity-60' : ''}>{rightAction}</div>
      </div>
    </div>
  );
}
