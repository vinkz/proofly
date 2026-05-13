import type { ReactNode } from 'react';
import { clsx } from 'clsx';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  cta?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, cta, className }: EmptyStateProps) {
  return (
    <div
      className={clsx(
        'rounded-[16px] border-[0.5px] border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-6 py-10 text-center text-[var(--color-text-primary)]',
        className,
      )}
    >
      {icon ? (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-background-tertiary)] text-[var(--color-text-secondary)]">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-medium text-[var(--color-text-primary)]">{title}</h3>
      {description ? (
        <p className="mt-1.5 text-sm font-normal text-[var(--color-text-secondary)]">{description}</p>
      ) : null}
      {cta ? <div className="mt-5 flex justify-center">{cta}</div> : null}
    </div>
  );
}
