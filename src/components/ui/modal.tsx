'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  return createPortal(
    open ? (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-8 pt-16 sm:items-center">
        <div className="absolute inset-0" onClick={onClose} aria-hidden />
        <div className="relative z-10 w-full max-w-lg rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-[18px] text-[var(--color-text-primary)]">
          <div className="flex items-center justify-between gap-3">
            {title ? (
              <h2 className="text-base font-medium text-[var(--color-text-primary)]">{title}</h2>
            ) : (
              <span aria-hidden />
            )}
            <button
              type="button"
              className="rounded-full px-3 py-1 text-xs font-medium text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-background-tertiary)] hover:text-[var(--color-text-primary)]"
              onClick={onClose}
            >
              Close
            </button>
          </div>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    ) : null,
    document.body,
  );
}
