'use client';

import { useMemo, useState } from 'react';

type CollapsibleSectionProps = {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  children: React.ReactNode;
};

export function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  forceOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = useMemo(() => forceOpen || open, [forceOpen, open]);

  return (
    <section className="rounded-3xl border border-white/20 bg-white/85 shadow-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={isOpen}
        onClick={() => {
          if (!forceOpen) setOpen((prev) => !prev);
        }}
      >
        <div>
          <p className="text-sm font-semibold text-muted">{title}</p>
          {subtitle ? <p className="text-xs text-muted-foreground/70">{subtitle}</p> : null}
        </div>
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm text-muted transition ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>
      {isOpen ? <div className="border-t border-white/10 px-4 pb-4 pt-3">{children}</div> : null}
    </section>
  );
}
