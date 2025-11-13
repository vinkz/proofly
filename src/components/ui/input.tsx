import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className = '', ...props }, ref) => (
  <input
    ref={ref}
    className={`w-full rounded-2xl border border-white/15 bg-surface-elevated/60 px-3 py-2 text-sm text-muted-foreground shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    {...props}
  />
));

Input.displayName = 'Input';
