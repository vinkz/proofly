import { Suspense } from 'react';

import { ScanJobSheetClient } from './scan-job-sheet-client';

export default function ScanJobSheetPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-3 px-4 py-10">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold text-[var(--brand)]">Scan Job Sheet</h1>
        <p className="text-sm text-muted-foreground/70">
          Capture a job sheet to start a new record.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground/70">Loading camera…</p>}>
        <ScanJobSheetClient />
      </Suspense>
    </div>
  );
}
