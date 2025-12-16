import { cloneElement, forwardRef, isValidElement } from 'react';
import type { ButtonHTMLAttributes, ReactElement } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  asChild?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--accent)] text-white shadow-brand hover:bg-[var(--brand)] focus-visible:outline-[var(--accent)]',
  secondary: 'border border-white/15 bg-white/5 text-muted hover:bg-white/10 focus-visible:outline-[var(--accent)]',
  outline: 'border border-white/15 text-muted hover:bg-white/5 focus-visible:outline-[var(--accent)]',
  ghost: 'text-muted-foreground hover:bg-white/5 focus-visible:outline-[var(--accent)]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', type = 'button', asChild = false, children, ...props }, ref) => {
    const variantClass = variantClasses[variant];
    const baseClasses = `inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60 ${variantClass} ${className}`;

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
