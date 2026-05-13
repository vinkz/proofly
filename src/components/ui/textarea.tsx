import { forwardRef } from 'react';
import type { TextareaHTMLAttributes } from 'react';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ className = '', ...props }, ref) => (
  <textarea
    ref={ref}
    className={`block min-h-[88px] w-full rounded-[8px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2.5 text-sm font-normal text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] transition-colors focus:border-[var(--color-action)] focus:outline-none focus:ring-[3px] focus:ring-[var(--color-action-ring)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:bg-[var(--color-background-tertiary)] disabled:text-[var(--color-text-tertiary)] ${className}`}
    {...props}
  />
));

Textarea.displayName = 'Textarea';
