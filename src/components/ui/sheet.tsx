'use client';

import {
  cloneElement,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { ButtonHTMLAttributes, HTMLAttributes, MouseEvent } from 'react';
import { clsx } from 'clsx';

interface SheetState {
  open: boolean;
  setOpen: (value: boolean) => void;
}

const SheetContext = createContext<SheetState | null>(null);

type ClickableChild = ReactElement<{
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  className?: string;
}>;

export interface SheetProps {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Sheet({ children, open, onOpenChange }: SheetProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof open === 'boolean';
  const currentOpen = isControlled ? open : internalOpen;

  const setOpen = useCallback(
    (value: boolean) => {
      if (!isControlled) {
        setInternalOpen(value);
      }
      onOpenChange?.(value);
    },
    [isControlled, onOpenChange],
  );

  const value = useMemo<SheetState>(() => ({ open: currentOpen, setOpen }), [currentOpen, setOpen]);

  return <SheetContext.Provider value={value}>{children}</SheetContext.Provider>;
}

function useSheetContext() {
  const context = useContext(SheetContext);
  if (!context) {
    throw new Error('Sheet components must be used within a <Sheet> parent.');
  }
  return context;
}

export interface SheetTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  children: ReactElement | ReactNode;
}

export function SheetTrigger({ asChild, children, className, onClick, ...props }: SheetTriggerProps) {
  const { setOpen } = useSheetContext();

  if (asChild && typeof children === 'object' && children !== null && 'props' in children) {
    const child = children as ClickableChild;
    return cloneElement(child, {
      onClick: (event: MouseEvent<HTMLElement>) => {
        child.props?.onClick?.(event);
        if (!event.defaultPrevented) {
          setOpen(true);
          onClick?.(event as unknown as MouseEvent<HTMLButtonElement>);
        }
      },
    });
  }

  return (
    <button
      type="button"
      className={clsx(
        'text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]',
        className,
      )}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpen(true);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

type SheetSide = 'bottom' | 'left' | 'right';

const sideClasses: Record<SheetSide, string> = {
  bottom: 'left-0 right-0 bottom-0 rounded-t-[16px] border-t-[0.5px]',
  left: 'left-0 top-0 bottom-0 w-80 max-w-[90vw] rounded-r-[16px] border-r-[0.5px]',
  right: 'right-0 top-0 bottom-0 w-80 max-w-[90vw] rounded-l-[16px] border-l-[0.5px]',
};

export interface SheetContentProps extends HTMLAttributes<HTMLDivElement> {
  side?: SheetSide;
  title?: string;
  description?: string;
}

export function SheetContent({
  side = 'bottom',
  className,
  title,
  description,
  children,
  ...props
}: SheetContentProps) {
  const { open, setOpen } = useSheetContext();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        role="presentation"
        className="absolute inset-0 bg-black/40"
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={clsx(
          'absolute z-10 flex flex-col gap-4 border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-[18px] text-[var(--color-text-primary)]',
          sideClasses[side],
          className,
        )}
        {...props}
      >
        {(title || description) ? (
          <header className="space-y-1">
            {title ? (
              <h3 className="text-base font-medium text-[var(--color-text-primary)]">{title}</h3>
            ) : null}
            {description ? (
              <p className="text-sm text-[var(--color-text-secondary)]">{description}</p>
            ) : null}
          </header>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export interface SheetCloseProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  children: ReactElement | ReactNode;
}

export function SheetClose({ asChild, children, className, onClick, ...props }: SheetCloseProps) {
  const { setOpen } = useSheetContext();

  if (asChild && typeof children === 'object' && children !== null && 'props' in children) {
    const child = children as ClickableChild;
    return cloneElement(child, {
      onClick: (event: MouseEvent<HTMLElement>) => {
        child.props?.onClick?.(event);
        if (!event.defaultPrevented) {
          setOpen(false);
          onClick?.(event as unknown as MouseEvent<HTMLButtonElement>);
        }
      },
    });
  }

  return (
    <button
      type="button"
      className={clsx(
        'text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]',
        className,
      )}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpen(false);
      }}
      {...props}
    >
      {children}
    </button>
  );
}
