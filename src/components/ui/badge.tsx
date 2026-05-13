import type { HTMLAttributes } from 'react';
import { clsx } from 'clsx';

type BadgeVariant = 'brand' | 'accent' | 'muted' | 'outline';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

const variantMap: Record<BadgeVariant, string> = {
  brand: 'bg-[var(--color-background-tertiary)] text-[var(--color-text-primary)]',
  accent: 'bg-[var(--color-action-bg)] text-[var(--color-action)]',
  muted: 'bg-[var(--color-background-tertiary)] text-[var(--color-text-tertiary)]',
  outline: 'border-[0.5px] border-[var(--color-border-secondary)] text-[var(--color-text-primary)]',
};

export function Badge({ className, variant = 'muted', dot = false, children, ...props }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none',
        variantMap[variant],
        className,
      )}
      {...props}
    >
      {dot ? <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
