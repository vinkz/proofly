'use client';

import Image from 'next/image';
import { useTransition } from 'react';

import { saveSignatures } from '@/server/jobs';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { useSignaturePad } from '@/hooks/useSignaturePad';

type Signer = 'plumber' | 'client';

interface SignaturePanelProps {
  jobId: string;
  existing: {
    plumber?: string | null;
    client?: string | null;
  };
}

export function SignaturePanel({ jobId, existing }: SignaturePanelProps) {
  const plumberPad = useSignaturePad();
  const clientPad = useSignaturePad();
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleSave = (signer: Signer) => {
    const pad = signer === 'plumber' ? plumberPad : clientPad;
    if (!pad.hasInk()) {
      pushToast({ title: 'Draw signature first', variant: 'error' });
      return;
    }
    const dataUrl = pad.toDataUrl();
    startTransition(async () => {
      try {
        await saveSignatures({
          jobId,
          plumber: signer === 'plumber' ? dataUrl : null,
          client: signer === 'client' ? dataUrl : null,
        });
        pushToast({ title: `${signer === 'plumber' ? 'Engineer' : 'Client'} signature saved`, variant: 'success' });
        pad.clear();
      } catch (error) {
        pushToast({
          title: 'Unable to save signature',
          description: error instanceof Error ? error.message : 'Try again shortly.',
          variant: 'error',
        });
      }
    });
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <SignatureCard
        title="Engineer signature"
        pad={plumberPad}
        onSave={() => handleSave('plumber')}
        disabled={isPending}
        existing={existing.plumber ?? null}
      />
      <SignatureCard
        title="Client signature"
        pad={clientPad}
        onSave={() => handleSave('client')}
        disabled={isPending}
        existing={existing.client ?? null}
      />
    </div>
  );
}

interface SignatureCardProps {
  title: string;
  pad: ReturnType<typeof useSignaturePad>;
  onSave: () => void;
  disabled: boolean;
  existing: string | null;
}

function SignatureCard({ title, pad, onSave, disabled, existing }: SignatureCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/70 p-4 shadow-sm">
      <p className="text-sm font-semibold text-muted">{title}</p>
      <div className="mt-3 space-y-2">
        <canvas
          ref={pad.canvasRef}
          className="h-40 w-full rounded-xl border border-dashed border-white/40 bg-white"
          {...pad.handlers}
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground/70">
          <span>Use a finger or mouse to sign</span>
          <button
            type="button"
            className="text-[var(--accent)] underline"
            onClick={pad.clear}
            disabled={disabled}
          >
            Clear
          </button>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onSave} disabled={disabled}>
          Save signature
        </Button>
      </div>
      {existing ? (
        <div className="mt-4 rounded-lg border border-white/20 bg-white/80 p-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Existing</p>
          <Image
            src={existing}
            alt={`${title} preview`}
            width={320}
            height={120}
            className="mt-2 h-24 w-full rounded border border-white/40 object-contain"
            unoptimized
          />
        </div>
      ) : null}
    </div>
  );
}
