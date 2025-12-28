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
      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white px-3 py-2 text-left text-sm text-slate-700 shadow-sm hover:border-slate-300"
    >
      <span className="font-medium text-slate-900">{label}</span>
      <span className="text-xs text-slate-500">{valueText || 'Not set'}</span>
    </button>
  );
}
