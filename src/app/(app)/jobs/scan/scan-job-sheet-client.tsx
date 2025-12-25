'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Scanner, type IDetectedBarcode } from '@yudiel/react-qr-scanner';

const parseCode = (value: string) => {
  try {
    const url = new URL(value);
    const codeParam = url.searchParams.get('code');
    if (codeParam && codeParam.trim()) {
      return codeParam.trim();
    }
    return value.trim();
  } catch {
    return value.trim();
  }
};

type QrScannerProps = {
  onDecode: (value: string | null) => void;
  onError?: (error: unknown) => void;
};

function QrScanner({ onDecode, onError }: QrScannerProps) {
  const handleScan = useCallback(
    (detectedCodes: IDetectedBarcode[]) => {
      onDecode(detectedCodes[0]?.rawValue ?? null);
    },
    [onDecode],
  );

  return <Scanner onScan={handleScan} onError={onError} />;
}

export function ScanJobSheetClient() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleDecode = useCallback(
    async (value: string | null) => {
      if (!value || isLoading) return;
      setIsLoading(true);
      setError(null);

      const code = parseCode(value);
      if (!code) {
        setIsLoading(false);
        setError('Invalid code scanned.');
        return;
      }

      try {
        const response = await fetch('/api/job-sheets/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        if (!response.ok) {
          const payload: unknown = await response.json().catch(() => null);
          const message =
            typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string'
              ? payload.error
              : 'Job sheet not recognised. Try again.';
          setError(message);
          setIsLoading(false);
          return;
        }

        const payload: unknown = await response.json();
        if (typeof payload !== 'object' || payload === null || !('jobId' in payload) || typeof payload.jobId !== 'string') {
          setError('Invalid server response. Please try again.');
          setIsLoading(false);
          return;
        }

        router.push(`/jobs/${payload.jobId}?resume=1`);
      } catch {
        setError('Failed to look up job. Please try again.');
        setIsLoading(false);
      }
    },
    [isLoading, router],
  );

  return (
    <div className="space-y-3 rounded-2xl border border-white/20 bg-white/80 p-4 shadow-sm">
      <QrScanner
        onDecode={(result) => handleDecode(result || null)}
        onError={(err) => {
          console.error(err);
          setError('Camera error. Check permissions and try again.');
        }}
      />
      {isLoading ? <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Looking up job…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
