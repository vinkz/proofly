'use client';

import { useState } from 'react';

import { SignaturePad } from '@/components/certificates/signature-pad';
import { useToast } from '@/components/ui/use-toast';

type SignatureCardProps = {
  label: string;
  existingUrl?: string;
  onUpload?: (file: File) => void;
};

/**
 * The paid flow's signature card.
 *
 * Now a thin wrapper around the shared SignaturePad, so the wizard and the free
 * tools present the same control. The only difference this file still owns is
 * persistence: the drawn signature becomes a File and is handed to the caller
 * to upload, where the free tools keep theirs in memory.
 */
export function SignatureCard({ label, existingUrl, onUpload }: SignatureCardProps) {
  const { pushToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [captured, setCaptured] = useState(false);

  const handleCapture = async (dataUrl: string) => {
    if (!onUpload) return;
    setIsSaving(true);
    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `${label.toLowerCase()}-signature.png`, { type: 'image/png' });
      onUpload(file);
      setCaptured(true);
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
      <p className="mb-3 text-[13px] font-medium text-[var(--color-text-primary)]">{label} signature</p>
      <SignaturePad
        label={label}
        captured={captured}
        busy={isSaving}
        existingUrl={existingUrl}
        hint="Draw a signature below."
        onCapture={handleCapture}
        onClear={() => setCaptured(false)}
      />
    </div>
  );
}
