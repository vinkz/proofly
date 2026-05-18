import { useId, useState } from 'react';

type CollapsibleSectionProps = {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

export function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <section className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] shadow-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</p>
          {subtitle ? (
            <p className="text-xs text-[var(--color-text-secondary)]">{subtitle}</p>
          ) : null}
        </div>
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)] transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        >
          ▼
        </span>
      </button>
      <div id={contentId} hidden={!isOpen} className="px-4 pb-4">
        {children}
      </div>
    </section>
  );
}
