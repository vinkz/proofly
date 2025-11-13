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
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-8 pt-16 backdrop-blur-sm sm:items-center">
        <div className="absolute inset-0" onClick={onClose} aria-hidden />
        <div className="relative z-10 w-full max-w-lg rounded-2xl border border-white/10 bg-surface-elevated/95 p-6 text-muted-foreground shadow-brand">
          <div className="flex items-center justify-between">
            {title ? <h2 className="text-lg font-semibold text-muted">{title}</h2> : null}
            <button
              type="button"
              className="rounded-2xl px-3 py-1 text-xs text-muted-foreground hover:bg-white/10"
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
