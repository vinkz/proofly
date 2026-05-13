import Image from 'next/image';

import { RequestJobClient } from './request-job-client';

export default function RequestJobPage() {
  return (
    <main className="min-h-screen bg-[var(--muted)] px-4 py-6 text-gray-900 sm:px-6">
      <section className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-2xl border border-white/10 bg-[var(--surface)]/90 p-6 shadow-md backdrop-blur">
          <Image src="/certnow-logo.svg" alt="certnow" width={150} height={34} priority />
          <h1 className="mt-4 text-3xl font-bold text-[var(--brand)]">
            Request a gas safety visit
          </h1>
          <p className="mt-2 text-sm text-muted-foreground/80">
            Enter your engineer&apos;s email or phone to get started.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/95 p-6 shadow">
          <RequestJobClient />
        </div>
      </section>
    </main>
  );
}
