'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { CERTIFICATE_LABELS, CERTIFICATE_TYPES } from '@/types/certificates';

const DISABLED_TYPES = ['electrical-minor'] as const;

export function CertificateTypeModal() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleSelect = (type: string, disabled?: boolean) => {
    if (disabled) return;
    setOpen(false);
    router.push(`/wizard/create/${type}`);
  };

  return (
    <>
      <Button type="button" className="rounded-full bg-[var(--accent)] px-4 py-2 text-white" onClick={() => setOpen(true)}>
        + New Certificate
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--accent)]">Certificate types</p>
                <h2 className="text-xl font-semibold text-muted">Choose a certificate</h2>
              </div>
              <button
                type="button"
                className="rounded-full bg-[var(--muted)] px-3 py-1 text-xs font-semibold text-gray-700"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {CERTIFICATE_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleSelect(type)}
                  className="w-full rounded-2xl border border-white/30 bg-[var(--muted)]/60 px-4 py-3 text-left shadow-sm transition hover:border-[var(--accent)] hover:bg-white"
                >
                  <p className="text-sm font-semibold text-muted">{CERTIFICATE_LABELS[type]}</p>
                  <p className="text-xs text-muted-foreground/70">Active</p>
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleSelect('electrical-minor', true)}
                className={clsx(
                  'w-full rounded-2xl border border-dashed px-4 py-3 text-left',
                  'cursor-not-allowed border-white/40 bg-white/60 text-muted-foreground/70',
                )}
              >
                <p className="text-sm font-semibold">Electrical Minor Works</p>
                <p className="text-xs">Coming soon</p>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
