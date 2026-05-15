'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { useSignaturePad } from '@/hooks/useSignaturePad';
import { useToast } from '@/components/ui/use-toast';
import { saveProfileSignature, deleteProfileSignature } from '@/server/profile';

export function SavedSignatureSection({ existingUrl }: { existingUrl: string | null }) {
  const router = useRouter();
  const { pushToast } = useToast();
  const pad = useSignaturePad();
  const [isPending, startTransition] = useTransition();
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingUrl);
  const [showCanvas, setShowCanvas] = useState(!existingUrl);

  const handleSave = () => {
    if (!pad.hasInk()) {
      pushToast({ title: 'Draw your signature first', variant: 'error' });
      return;
    }
    startTransition(async () => {
      try {
        const dataUrl = pad.toDataUrl();
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const formData = new FormData();
        formData.append('file', new File([blob], 'profile-signature.png', { type: 'image/png' }));
        const { url } = await saveProfileSignature(formData);
        setPreviewUrl(url);
        setShowCanvas(false);
        pad.clear();
        pushToast({ title: 'Signature saved', variant: 'success' });
        router.refresh();
      } catch (error) {
        pushToast({
          title: 'Could not save signature',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteProfileSignature();
        setPreviewUrl(null);
        setShowCanvas(true);
        pad.clear();
        pushToast({ title: 'Signature removed', variant: 'success' });
        router.refresh();
      } catch (error) {
        pushToast({
          title: 'Could not remove signature',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'error',
        });
      }
    });
  };

  return (
    <div className="space-y-3">
      {previewUrl && !showCanvas ? (
        <div className="rounded-[12px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-medium text-[var(--color-text-secondary)]">Saved signature</p>
              <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)]">Pre-fills on every new certificate</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCanvas(true)}
                disabled={isPending}
                className="h-[30px] rounded-[8px] border-[0.5px] border-[var(--color-border-secondary)] bg-transparent px-3 text-[12px] text-[var(--color-text-secondary)] disabled:opacity-50"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="h-[30px] rounded-[8px] bg-[var(--color-red-bg)] px-3 text-[12px] text-[var(--color-red)] disabled:opacity-50"
              >
                {isPending ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Saved engineer signature"
            className="mt-3 h-16 max-w-[240px] rounded-[8px] border-[0.5px] border-[var(--color-border-tertiary)] bg-white object-contain p-1"
          />
        </div>
      ) : null}

      {showCanvas ? (
        <div className="rounded-[12px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] p-4">
          <p className="text-[12px] font-medium text-[var(--color-text-secondary)]">Draw your signature</p>
          <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)]">
            This will pre-fill on every new CP12 and boiler service certificate.
          </p>
          <div className="mt-3 h-[120px] w-full touch-none rounded-[10px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)]">
            <canvas
              ref={pad.canvasRef}
              className="h-full w-full touch-none rounded-[10px]"
              style={{ touchAction: 'none', overscrollBehavior: 'contain', userSelect: 'none' }}
              {...pad.handlers}
            />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={pad.clear}
              disabled={isPending}
              className="h-[34px] rounded-[8px] border-[0.5px] border-[var(--color-border-secondary)] bg-transparent px-3 text-[12px] text-[var(--color-text-secondary)] disabled:opacity-50"
            >
              Clear
            </button>
            {previewUrl && (
              <button
                type="button"
                onClick={() => { pad.clear(); setShowCanvas(false); }}
                disabled={isPending}
                className="h-[34px] rounded-[8px] border-[0.5px] border-[var(--color-border-secondary)] bg-transparent px-3 text-[12px] text-[var(--color-text-secondary)] disabled:opacity-50"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="h-[34px] flex-1 rounded-[8px] bg-[#111] text-[12px] font-medium text-white disabled:opacity-50"
            >
              {isPending ? 'Saving…' : 'Save signature'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
