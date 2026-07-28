'use client';

/**
 * The signature pad, shared by the free tools and the paid wizard.
 *
 * Presentational only: it draws, and hands back a data URL. What happens next
 * differs — the free tools keep it in memory and never persist it, the paid
 * flow uploads it to storage — so persistence stays with the caller and the
 * two flows still look and behave identically to the engineer.
 *
 * Captured state is shown explicitly. A signature that silently did or did not
 * take is the one thing on this form worth being unambiguous about, since a
 * CP12 without an engineer signature cannot be issued at all.
 */
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useSignaturePad } from '@/hooks/useSignaturePad';

type Props = {
  label: string;
  /** True once a signature has been captured, however the caller stores it. */
  captured: boolean;
  /** Receives a PNG data URL. */
  onCapture: (dataUrl: string) => void | Promise<void>;
  onClear: () => void;
  /** An already-stored signature to show alongside the pad. */
  existingUrl?: string;
  busy?: boolean;
  hint?: string;
};

export function SignaturePad({
  label,
  captured,
  onCapture,
  onClear,
  existingUrl,
  busy = false,
  hint,
}: Props) {
  const pad = useSignaturePad();
  const [error, setError] = useState<string | null>(null);

  const capture = async () => {
    if (!pad.hasInk()) {
      setError('Draw your signature in the box first.');
      return;
    }
    setError(null);
    await onCapture(pad.toDataUrl());
  };

  const clear = () => {
    pad.clear();
    setError(null);
    onClear();
  };

  return (
    <div className="grid gap-4">
      {hint ? <p className="text-[13px] text-[var(--color-text-tertiary)]">{hint}</p> : null}

      <div className="touch-none rounded-[12px] border-[0.5px] border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3">
        <canvas
          ref={pad.canvasRef}
          className="h-[140px] w-full touch-none rounded-[8px] bg-white"
          style={{ touchAction: 'none', overscrollBehavior: 'contain', userSelect: 'none' }}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={capture} disabled={busy}>
          {busy ? 'Saving…' : captured ? 'Replace signature' : 'Use this signature'}
        </Button>
        <Button variant="ghost" onClick={clear} disabled={busy}>
          Clear
        </Button>
      </div>

      {error ? <p className="text-[13px] text-[var(--color-red)]">{error}</p> : null}
      {captured && !error ? (
        <p className="text-[13px] text-[var(--color-text-tertiary)]">{label} signature captured.</p>
      ) : null}

      {existingUrl ? (
        <div className="rounded-[12px] border-[0.5px] border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3">
          <p className="text-[12px] text-[var(--color-text-tertiary)]">Signature on file</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={existingUrl} alt={`${label} signature`} className="mt-2 h-16 rounded-lg object-contain" />
        </div>
      ) : null}
    </div>
  );
}
