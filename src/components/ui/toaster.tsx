'use client';

import { useToast } from './use-toast';

const variants = {
  default:
    'bg-[var(--color-background-primary)] text-[var(--color-text-primary)] border-[var(--color-border-tertiary)]',
  success:
    'bg-[var(--color-action-bg)] text-[var(--color-action)] border-[var(--color-action-bg)]',
  warning:
    'bg-[var(--color-amber-bg)] text-[var(--color-amber)] border-[var(--color-amber-bg)]',
  error:
    'bg-[var(--color-red-bg)] text-[var(--color-red)] border-[var(--color-red-bg)]',
} as const;

export function Toaster() {
  const { toasts, dismissToast } = useToast();

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-[16px] border-[0.5px] px-4 py-3 ${
            variants[toast.variant ?? 'default']
          }`}
        >
          <div className="flex-1">
            <p className="text-sm font-medium leading-tight">{toast.title}</p>
            {toast.description ? (
              <div className="mt-1 text-xs font-normal opacity-80">{toast.description}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            className="rounded-full px-2 py-1 text-xs font-medium opacity-70 transition-opacity hover:opacity-100"
          >
            Close
          </button>
        </div>
      ))}
    </div>
  );
}
