import { forwardRef } from 'react';
import type { SelectHTMLAttributes } from 'react';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ className = '', ...props }, ref) => (
  <select
    ref={ref}
    className={`w-full rounded-md border border-white/15 bg-surface-elevated/60 px-3 py-2 text-sm text-muted-foreground shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    {...props}
  />
));

Select.displayName = 'Select';
