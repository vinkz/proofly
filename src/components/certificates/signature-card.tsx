'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';

type SignatureCardProps = {
  label: string;
  existingUrl?: string;
  onUpload?: (file: File) => void;
};

export function SignatureCard({ label, existingUrl, onUpload }: SignatureCardProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    onUpload?.(file);
  };

  return (
    <div className="rounded-3xl border border-white/30 bg-white/90 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted">{label} signature</p>
        <span className="rounded-full bg-[var(--muted)] px-3 py-1 text-[11px] font-semibold uppercase text-[var(--brand)]">
          Upload
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground/60">Upload a signature photo or scanned sign-off.</p>
      <div className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-white/40 bg-[var(--muted)]/60 p-3">
        {existingUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={existingUrl} alt={`${label} signature`} className="h-16 w-16 rounded-lg object-cover" />
        ) : (
          <div className="h-16 w-16 rounded-lg bg-white/70" />
        )}
        <div>
          <p className="text-xs text-muted-foreground/70">
            {existingUrl ? 'Signature on file' : 'No signature yet'}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-2 rounded-full"
            onClick={() => inputRef.current?.click()}
          >
            {existingUrl ? 'Replace signature' : 'Upload signature'}
          </Button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>
      </div>
    </div>
  );
}
