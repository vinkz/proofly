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
      <div className="pointer-events-auto mx-auto flex w-full max-w-6xl items-center justify-between gap-4 border-t border-slate-200/80 bg-white/95 px-4 py-3 shadow-[0_-6px_20px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="text-xs text-slate-500">
          {leftContent}
          {hint ? <span className="ml-2 text-slate-400">{hint}</span> : null}
        </div>
        <div className={disabled ? 'opacity-60' : ''}>{rightAction}</div>
      </div>
    </div>
  );
}
