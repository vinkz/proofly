import { forwardRef } from 'react';
import type { SelectHTMLAttributes } from 'react';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ className = '', ...props }, ref) => (
  <select
    ref={ref}
    className={`block h-11 w-full rounded-[8px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 pr-8 text-sm font-normal text-[var(--color-text-primary)] transition-colors focus:border-[var(--color-action)] focus:outline-none focus:ring-[3px] focus:ring-[var(--color-action-ring)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:bg-[var(--color-background-tertiary)] disabled:text-[var(--color-text-tertiary)] ${className}`}
    {...props}
  />
));

Select.displayName = 'Select';
