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
        'rounded-2xl border border-dashed border-white/15 bg-surface-elevated/60 px-8 py-12 text-center text-muted-foreground shadow-brand backdrop-blur-sm',
        className,
      )}
    >
      {icon ? <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-white/5 text-muted">{icon}</div> : null}
      <h3 className="text-lg font-semibold text-muted">{title}</h3>
      {description ? <p className="mt-2 text-sm text-muted-foreground/80">{description}</p> : null}
      {cta ? <div className="mt-6 flex justify-center">{cta}</div> : null}
    </div>
  );
}
