type SummaryRowProps = {
  label: string;
  valueText?: string;
  onClick?: () => void;
};

export function SummaryRow({ label, valueText, onClick }: SummaryRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-[12px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2 text-left text-sm text-[var(--color-text-primary)] shadow-sm hover:border-[var(--color-border-primary)]"
    >
      <span className="font-medium text-[var(--color-text-primary)]">{label}</span>
      <span className="text-xs text-[var(--color-text-secondary)]">{valueText || 'Not set'}</span>
    </button>
  );
}
