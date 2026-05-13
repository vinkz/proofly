import { cloneElement, forwardRef, isValidElement } from 'react';
import type { ButtonHTMLAttributes, ReactElement } from 'react';

type ButtonVariant = 'primary' | 'action' | 'secondary' | 'outline' | 'ghost' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  asChild?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-cta)] text-[var(--color-cta-fg)] hover:bg-[var(--color-text-primary)] focus-visible:ring-[var(--color-action-ring)] focus-visible:ring-offset-0',
  action:
    'bg-[var(--color-action)] text-[var(--color-action-fg)] hover:brightness-95 focus-visible:ring-[var(--color-action-ring)] focus-visible:ring-offset-0',
  secondary:
    'bg-transparent border-[0.5px] border-[var(--color-border-secondary)] text-[var(--color-text-primary)] hover:bg-[var(--color-background-tertiary)] focus-visible:ring-[var(--color-action-ring)]',
  outline:
    'bg-transparent border-[0.5px] border-[var(--color-border-primary)] text-[var(--color-text-primary)] hover:bg-[var(--color-background-tertiary)] focus-visible:ring-[var(--color-action-ring)]',
  ghost:
    'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-background-tertiary)] hover:text-[var(--color-text-primary)] focus-visible:ring-[var(--color-action-ring)]',
  danger:
    'bg-[var(--color-red-bg)] text-[var(--color-red)] hover:brightness-95 focus-visible:ring-[var(--color-action-ring)]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', type = 'button', asChild = false, children, ...props }, ref) => {
    const variantClass = variantClasses[variant];
    const baseClasses = `inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium leading-none transition-colors focus:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 ${variantClass} ${className}`;

    if (asChild && isValidElement(children)) {
      const child = children as ReactElement<{ className?: string }>;
      const childClassName = `${baseClasses} ${child.props?.className ?? ''}`.trim();
      return cloneElement(child, {
        className: childClassName,
        ...props,
      });
    }

    return (
      <button ref={ref} type={type} className={baseClasses} {...props}>
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
