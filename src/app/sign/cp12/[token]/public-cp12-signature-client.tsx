'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';

import { SignatureCard } from '@/components/certificates/signature-card';
import { useToast } from '@/components/ui/use-toast';
import { submitCp12RemoteCustomerSignature } from '@/server/certificates';

export function PublicCp12SignatureClient({ token }: { token: string }) {
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [completedPdfUrl, setCompletedPdfUrl] = useState<string | null>(null);

  if (completedPdfUrl) {
    return (
      <div className="rounded-3xl border border-white/20 bg-white/90 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-muted">Signature received</h2>
        <p className="mt-2 text-sm text-muted-foreground/70">
          The CP12 has been finalized and is ready to open.
        </p>
        <Link
          href={completedPdfUrl}
          target="_blank"
          className="mt-4 inline-flex rounded-full bg-[var(--action)] px-4 py-2 text-sm font-medium text-white"
        >
          Open completed certificate
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SignatureCard
        label="Landlord / Responsible person"
        onUpload={(file) => {
          startTransition(async () => {
            try {
              const result = await submitCp12RemoteCustomerSignature({ token, file });
              setCompletedPdfUrl(result.pdfUrl);
              pushToast({ title: 'Signature submitted', variant: 'success' });
            } catch (error) {
              pushToast({
                title: 'Could not submit signature',
                description: error instanceof Error ? error.message : 'Please try again.',
                variant: 'error',
              });
            }
          });
        }}
      />
      <p className="text-xs text-muted-foreground/70">
        {isPending ? 'Submitting signature and finalizing certificate…' : 'Draw and save the signature above to complete the certificate.'}
      </p>
    </div>
  );
}
