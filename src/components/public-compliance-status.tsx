import type { PublicComplianceInfo } from '@/lib/public-compliance';

export function PublicComplianceStatusRow({
  compliance,
  className = '',
}: {
  compliance: PublicComplianceInfo;
  className?: string;
}) {
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <div
        className="mt-1 h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: compliance.dotColor }}
        aria-hidden="true"
      />
      <div>
        <p className="text-[13px] font-medium text-[var(--color-text-primary)]">{compliance.label}</p>
        {compliance.sub ? (
          <p className="mt-0.5 text-[12px] text-[var(--color-text-tertiary)]">{compliance.sub}</p>
        ) : null}
      </div>
    </div>
  );
}
