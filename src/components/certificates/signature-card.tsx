'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSignaturePad } from '@/hooks/useSignaturePad';
import { useToast } from '@/components/ui/use-toast';

type SignatureCardProps = {
  label: string;
  existingUrl?: string;
  onUpload?: (file: File) => void;
};

export function SignatureCard({ label, existingUrl, onUpload }: SignatureCardProps) {
  const { pushToast } = useToast();
  const pad = useSignaturePad();
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveDrawn = async () => {
    if (!onUpload) return;
    if (!pad.hasInk()) {
      pushToast({ title: 'Draw a signature first', variant: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      const dataUrl = pad.toDataUrl();
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `${label.toLowerCase()}-signature.png`, { type: 'image/png' });
      onUpload(file);
      pad.clear();
      pushToast({ title: 'Signature saved', variant: 'success' });
    } catch (error) {
      pushToast({
        title: 'Could not save signature',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-[16px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] p-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-[var(--color-text-primary)]">{label} signature</p>
        <span className="rounded-full bg-[var(--color-background-secondary)] px-3 py-1 text-[11px] font-medium uppercase text-[var(--color-text-secondary)]">
          Draw
        </span>
      </div>
      <p className="mt-1 text-[12px] text-[var(--color-text-tertiary)]">Draw a signature below.</p>
      <div className="mt-3 touch-none rounded-[12px] border-[0.5px] border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3">
        <p className="text-[11px] uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">Draw signature</p>
        <div className="mt-2 h-28 w-full touch-none overscroll-contain rounded-[12px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)]">
          <canvas
            ref={pad.canvasRef}
            className="h-full w-full touch-none rounded-2xl"
            style={{ touchAction: 'none', overscrollBehavior: 'contain', userSelect: 'none' }}
            {...pad.handlers}
          />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Button type="button" variant="outline" className="rounded-full text-xs" onClick={pad.clear}>
            Clear
          </Button>
          <Button
            type="button"
            className="rounded-full text-xs"
            onClick={handleSaveDrawn}
            disabled={isSaving || !onUpload}
          >
            {isSaving ? 'Saving…' : 'Save drawn signature'}
          </Button>
        </div>
      </div>
      {existingUrl ? (
        <div className="mt-3 rounded-[12px] border-[0.5px] border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-3">
          <p className="text-[12px] text-[var(--color-text-tertiary)]">Signature on file</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={existingUrl} alt={`${label} signature`} className="mt-2 h-16 w-16 rounded-lg object-cover" />
        </div>
      ) : null}
    </div>
  );
}
