'use client';

import { useToast } from './use-toast';

const variants = {
  default: 'border-gray-200 bg-white text-gray-900',
  success: 'border-green-300 bg-green-50 text-green-900',
  error: 'border-red-300 bg-red-50 text-red-900',
} as const;

export function Toaster() {
  const { toasts, dismissToast } = useToast();

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-md border px-4 py-3 shadow ${
            variants[toast.variant ?? 'default']
          }`}
        >
          <div className="flex-1">
            <p className="text-sm font-medium">{toast.title}</p>
            {toast.description ? <p className="mt-1 text-xs text-gray-600">{toast.description}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
          >
            Close
          </button>
        </div>
      ))}
    </div>
  );
}
