'use client';

import Image from 'next/image';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { saveSignatures } from '@/server/jobs';
import { useToast } from '@/components/ui/use-toast';
import { useSignaturePad } from '@/hooks/useSignaturePad';

type Signer = 'plumber' | 'client';

interface SignatureModalProps {
  jobId: string;
  signatures: { signer: Signer; signedUrl: string | null }[];
}

export function SignatureModal({ jobId, signatures }: SignatureModalProps) {
  const [open, setOpen] = useState(false);
  const [activeSigner, setActiveSigner] = useState<Signer>('plumber');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { pushToast } = useToast();

  const plumberPad = useSignaturePad();
  const clientPad = useSignaturePad();

  const getPad = (signer: Signer) => (signer === 'plumber' ? plumberPad : clientPad);

  const handleSave = (signer: Signer) => {
    const pad = getPad(signer);
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
        pushToast({ title: 'Signature saved', variant: 'success' });
        router.refresh();
        setOpen(false);
      } catch (error) {
        pushToast({
          title: 'Could not save signature',
          description: error instanceof Error ? error.message : 'Try again shortly.',
          variant: 'error',
        });
      }
    });
  };

  const currentSignatureUrl = signatures.find((item) => item.signer === activeSigner)?.signedUrl ?? null;

  return (
    <>
      <button
        type="button"
        className="rounded border px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        onClick={() => setOpen(true)}
      >
        Capture signatures
      </button>
      {open ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Signoff</h2>
              <button
                type="button"
                className="rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Close
              </button>
            </div>
            <div className="mt-4 flex gap-2 border-b">
              {(['plumber', 'client'] as Signer[]).map((signer) => (
                <button
                  key={signer}
                  type="button"
                  className={`rounded-t px-3 py-2 text-sm font-medium ${
                    activeSigner === signer ? 'border border-b-0 border-gray-200 bg-white' : 'text-gray-500'
                  }`}
                  onClick={() => setActiveSigner(signer)}
                >
                  {signer === 'plumber' ? 'Plumber' : 'Client'}
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Draw Signature</p>
                <div className="mt-2 rounded border bg-gray-50 p-2">
                  <canvas
                    ref={plumberPad.canvasRef}
                    className={`h-40 w-full touch-none bg-white ${activeSigner === 'plumber' ? '' : 'hidden'}`}
                    style={{ pointerEvents: activeSigner === 'plumber' ? 'auto' : 'none' }}
                    {...(activeSigner === 'plumber' ? plumberPad.handlers : {})}
                  />
                  <canvas
                    ref={clientPad.canvasRef}
                    className={`h-40 w-full touch-none bg-white ${activeSigner === 'client' ? '' : 'hidden'}`}
                    style={{ pointerEvents: activeSigner === 'client' ? 'auto' : 'none' }}
                    {...(activeSigner === 'client' ? clientPad.handlers : {})}
                  />
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="rounded border px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                    onClick={() => (activeSigner === 'plumber' ? plumberPad.clear() : clientPad.clear())}
                    disabled={isPending}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                    onClick={() => handleSave(activeSigner)}
                    disabled={isPending}
                  >
                    {isPending ? 'Saving…' : 'Save signature'}
                  </button>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Current Signature</p>
                {currentSignatureUrl ? (
                  <Image
                    src={currentSignatureUrl}
                    alt={`${activeSigner} signature`}
                    width={320}
                    height={160}
                    unoptimized
                    className="mt-2 rounded border object-contain"
                  />
                ) : (
                  <p className="mt-2 text-sm text-gray-500">No signature on file.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
