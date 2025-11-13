import type { HTMLAttributes } from 'react';
import { clsx } from 'clsx';

type BadgeVariant = 'brand' | 'accent' | 'muted' | 'outline';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantMap: Record<BadgeVariant, string> = {
  brand: 'bg-brand text-muted shadow-sm',
  accent: 'bg-accent text-muted shadow-sm',
  muted: 'bg-white/10 text-muted-foreground',
  outline: 'border border-white/20 text-muted',
};

export function Badge({ className, variant = 'muted', ...props }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition',
        variantMap[variant],
        className,
      )}
      {...props}
    />
  );
}
