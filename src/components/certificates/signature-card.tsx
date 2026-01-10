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
    <div className="rounded-3xl border border-white/30 bg-white/90 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted">{label} signature</p>
        <span className="rounded-full bg-[var(--muted)] px-3 py-1 text-[11px] font-semibold uppercase text-[var(--brand)]">
          Draw
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground/60">Draw a signature below.</p>
      <div className="mt-3 rounded-2xl border border-dashed border-white/40 bg-[var(--muted)]/60 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Draw signature</p>
        <div className="mt-2 h-28 w-full rounded-2xl border border-white/30 bg-white/80">
          <canvas
            ref={pad.canvasRef}
            className="h-full w-full rounded-2xl"
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
        <div className="mt-3 rounded-2xl border border-dashed border-white/40 bg-[var(--muted)]/60 p-3">
          <p className="text-xs text-muted-foreground/70">Signature on file</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={existingUrl} alt={`${label} signature`} className="mt-2 h-16 w-16 rounded-lg object-cover" />
        </div>
      ) : null}
    </div>
  );
}
