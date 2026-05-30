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
    <div className="flex flex-col gap-[10px]">
      {previewUrl && !showCanvas ? (
        <div className="flex items-center gap-3 rounded-[10px] border-[0.5px] border-[var(--color-border-tertiary)] p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Saved engineer signature"
            className="h-12 w-20 flex-shrink-0 rounded-[6px] border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] object-contain p-1"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Saved</p>
            <p className="text-[12px] text-[var(--color-text-secondary)]">Pre-fills on every new certificate</p>
          </div>
          <div className="flex flex-shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setShowCanvas(true)}
              disabled={isPending}
              className="rounded-full border-[0.5px] border-[var(--color-border-secondary)] bg-transparent px-[12px] py-[5px] text-[12px] font-medium text-[var(--color-text-secondary)] disabled:opacity-50"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="rounded-full border-[0.5px] border-[#f09595] bg-[#fcebeb] px-[12px] py-[5px] text-[12px] font-medium text-[#a32d2d] disabled:opacity-50"
            >
              {isPending ? 'Removing…' : 'Remove'}
            </button>
          </div>
        </div>
      ) : null}

      {showCanvas ? (
        <div className="flex flex-col gap-[10px]">
          <p className="text-[12px] text-[var(--color-text-secondary)]">Draw your signature below. This will pre-fill on every new CP12 and boiler service certificate.</p>
          <div className="h-[120px] w-full touch-none rounded-[10px] border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]">
            <canvas
              ref={pad.canvasRef}
              className="h-full w-full touch-none rounded-[10px]"
              style={{ touchAction: 'none', overscrollBehavior: 'contain', userSelect: 'none' }}
              {...pad.handlers}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={pad.clear}
              disabled={isPending}
              className="rounded-full border-[0.5px] border-[var(--color-border-secondary)] bg-transparent px-[12px] py-[5px] text-[12px] font-medium text-[var(--color-text-secondary)] disabled:opacity-50"
            >
              Clear
            </button>
            {previewUrl ? (
              <button
                type="button"
                onClick={() => { pad.clear(); setShowCanvas(false); }}
                disabled={isPending}
                className="rounded-full border-[0.5px] border-[var(--color-border-secondary)] bg-transparent px-[12px] py-[5px] text-[12px] font-medium text-[var(--color-text-secondary)] disabled:opacity-50"
              >
                Cancel
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="flex-1 rounded-full bg-[#111] py-[10px] text-[13px] font-medium text-white disabled:opacity-50"
            >
              {isPending ? 'Saving…' : 'Save signature'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
