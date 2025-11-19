export function ProgressHeader({ step, total }: { step: number; total: number }) {
  const percent = Math.round((step / total) * 100);
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground/80">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-[var(--brand)]/10 px-3 py-1 text-xs font-semibold text-[var(--brand)]">
          Step {step} of {total}
        </span>
        <span>{percent}% complete</span>
      </div>
      <div className="h-2 flex-1 rounded-full bg-[var(--muted)] ml-4">
        <div className="h-2 rounded-full bg-[var(--action)]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
